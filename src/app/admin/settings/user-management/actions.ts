
"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma } from '@prisma/client';

export async function getUserManagementPageData() {
  try {
    const users = await databaseService.getAllUsers({
      include: { 
        roles: true, 
        managedBuildings: true // Buildings directly managed by this user
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
  targetUserId: string, // This is the User.id (cuid), not User.userId (from identity)
  selectedRoleIds: string[],
  selectedManagedBuildingIds: string[]
) {
  try {
    // 1. Update roles for the user
    await databaseService.updateUser(targetUserId, { // Assuming updateUser uses the User.id (cuid)
      roles: {
        set: selectedRoleIds.map(id => ({ id })),
      },
    });

    // 2. Update managed buildings
    // First, find all buildings currently managed by this user
    const currentlyManagedBuildings = await databaseService.getAllBuildings({
      where: { managedByUserId: targetUserId } // Assuming managedByUserId refers to User.userId (identity ID)
    });
    
    const userToUpdate = await databaseService.getUserById(targetUserId); // Fetch user by CUID
    if (!userToUpdate) {
        throw new Error("User not found with internal ID.");
    }
    const identityUserId = userToUpdate.userId; // This is the User.userId (from identity provider)

    // Buildings to remove user from (uncheck)
    const buildingsToUnassign = currentlyManagedBuildings.filter(
      b => !selectedManagedBuildingIds.includes(b.id)
    );
    for (const building of buildingsToUnassign) {
      await databaseService.updateBuilding(building.id, {
        manager: { disconnect: true } // This should set managedByUserId to null
      });
    }

    // Buildings to assign user to (check)
    for (const buildingId of selectedManagedBuildingIds) {
      // Check if this building is already managed by this user to avoid redundant updates
      const isAlreadyManaged = currentlyManagedBuildings.some(b => b.id === buildingId && b.managedByUserId === identityUserId);
      if (!isAlreadyManaged) {
        await databaseService.updateBuilding(buildingId, {
          manager: { connect: { userId: identityUserId } } // Connect using the User.userId (identity ID)
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
