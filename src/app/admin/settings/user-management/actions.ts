

"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma, type User, type Role } from '@prisma/client';
import { cookies } from 'next/headers';
import { getUserAndPermissions } from '@/lib/actions/server-helpers';
import { prisma } from '@/lib/prisma';


export async function getUserManagementPageData() {
  try {
    const users = await databaseService.getAllUsers({
      select: {
        id: true,
        userId: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        tempPassword: true,
        createdAt: true,
        updatedAt: true,
        roles: true, 
        managedBuildings: true,
      },
      orderBy: { createdAt: 'desc' }
    });
    const allRoles = await databaseService.getAllRoles({ orderBy: { name: 'asc' } });
    const allBuildings = await databaseService.getAllBuildings({ orderBy: { name: 'asc' } });
    
    return { success: true, users, allRoles, allBuildings };
  } catch (error: any) {
    console.error("Error fetching user management data:", error);
    return { success: false, error: error.message || "Failed to fetch data.", users: [], allRoles: [], allBuildings: [] };
  }
}

export async function updateUserAssignments(
  targetUserId: string,
  selectedRoleId: string | null,
  selectedManagedBuildingIds: string[]
) {
  try {
    const { isSuperAdmin, permissions } = await getUserAndPermissions();
    if (!isSuperAdmin && !permissions.has('settings:user_management:assign')) {
        return { success: false, error: "Permission denied." };
    }

    const userToUpdate = await databaseService.getUserById(targetUserId, { managedBuildings: true });
    if (!userToUpdate) {
      throw new Error("User not found for assignment update.");
    }
    
    // --- Corrected Logic ---
    // Instead of using connect/disconnect on the user, we will now use a transaction to
    // update the user's role and then update each affected building's list of managers.
    
    await prisma.$transaction(async (tx) => {
        // 1. Update the user's role. This part is simple.
        await tx.user.update({
            where: { id: targetUserId },
            data: {
                roles: selectedRoleId ? { set: [{ id: selectedRoleId }] } : { set: [] }
            }
        });

        // 2. Determine which buildings need to be added or removed from the user's management list.
        const currentBuildingIds = new Set(userToUpdate.managedBuildings.map(b => b.id));
        const newBuildingIds = new Set(selectedManagedBuildingIds);

        const buildingsToConnect = selectedManagedBuildingIds.filter(id => !currentBuildingIds.has(id));
        const buildingsToDisconnect = Array.from(currentBuildingIds).filter(id => !newBuildingIds.has(id));

        // 3. For each building to connect, add the user to its list of managers.
        for (const buildingId of buildingsToConnect) {
            await tx.building.update({
                where: { id: buildingId },
                data: {
                    managers: {
                        connect: { id: targetUserId }
                    }
                }
            });
        }

        // 4. For each building to disconnect, remove the user from its list of managers.
        for (const buildingId of buildingsToDisconnect) {
            await tx.building.update({
                where: { id: buildingId },
                data: {
                    managers: {
                        disconnect: { id: targetUserId }
                    }
                }
            });
        }
    });


    revalidatePath('/admin/settings/user-management');
    revalidatePath('/admin/buildings');
    return { success: true, message: "User assignments updated successfully." };

  } catch (error: any) {
    console.error("Error updating user assignments:", error);
    let errorMessage = "Failed to update user assignments.";
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      errorMessage = `A database error occurred: ${error.message}`;
    } else if (error.message) {
      errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
}
