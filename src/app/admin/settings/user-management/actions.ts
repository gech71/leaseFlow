

"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma, type User, type Role } from '@prisma/client';
import { cookies } from 'next/headers';
import { getUserAndPermissions } from '@/lib/actions/server-helpers';


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
    
    const buildingsToConnect = selectedManagedBuildingIds.map(id => ({ id }));
    const buildingsToDisconnect = userToUpdate.managedBuildings
        .filter(b => !selectedManagedBuildingIds.includes(b.id))
        .map(b => ({ id: b.id }));

    await databaseService.updateUser(targetUserId, {
      roles: selectedRoleId ? { set: [{ id: selectedRoleId }] } : { set: [] },
      managedBuildings: {
        connect: buildingsToConnect,
        disconnect: buildingsToDisconnect,
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
