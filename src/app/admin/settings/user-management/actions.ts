
"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma } from '@prisma/client';

export async function getUserManagementPageData() {
  try {
    const users = await databaseService.getAllUsers({
      include: { 
        roles: true, 
        managedBuildings: true
      },
      orderBy: { name: 'asc' }
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
  selectedRoleId: string | null, // Changed from string[] to string | null
  selectedManagedBuildingIds: string[]
) {
  try {
    // 1. Update role for the user
    await databaseService.updateUser(targetUserId, {
      roles: selectedRoleId ? { set: [{ id: selectedRoleId }] } : { set: [] }, // Handle single role or no role
    });

    // 2. Update managed buildings
    const userToUpdate = await databaseService.getUserById(targetUserId);
    if (!userToUpdate) {
        throw new Error("User not found with internal ID.");
    }
    const identityUserId = userToUpdate.userId;

    const currentlyManagedBuildings = await databaseService.getAllBuildings({
      where: { managedByUserId: identityUserId }
    });

    const buildingsToUnassign = currentlyManagedBuildings.filter(
      b => !selectedManagedBuildingIds.includes(b.id)
    );
    for (const building of buildingsToUnassign) {
      await databaseService.updateBuilding(building.id, {
        manager: { disconnect: true }
      });
    }

    for (const buildingId of selectedManagedBuildingIds) {
      const isAlreadyManaged = currentlyManagedBuildings.some(b => b.id === buildingId && b.managedByUserId === identityUserId);
      if (!isAlreadyManaged) {
        await databaseService.updateBuilding(buildingId, {
          manager: { connect: { userId: identityUserId } }
        });
      }
    }

    revalidatePath('/admin/settings/user-management');
    return { success: true, message: "User assignments updated successfully." };

  } catch (error: any) {
    console.error("Error updating user assignments:", error);
    let errorMessage = "Failed to update user assignments.";
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      errorMessage = `Database error: ${error.message}`;
    } else if (error.message) {
      errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
}
