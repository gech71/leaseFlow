
"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma, type User, type Role } from '@prisma/client';
import { cookies } from 'next/headers';
import { getUserAndPermissions } from '@/lib/actions/server-helpers';

export async function createBuildingAction(data: Prisma.BuildingCreateInput) {
  try {
    // Get the current user who is creating the building
    const { currentUser } = await getUserAndPermissions();
    if (!currentUser) {
        return { success: false, error: "Authentication required to create a building." };
    }

    // Add the current user's ID as the manager
    const dataWithManager = {
        ...data,
        manager: {
          connect: {
            userId: currentUser.userId
          }
        }
    };
    
    // The create call now includes the manager's ID
    const newBuilding = await databaseService.createBuilding(dataWithManager);
    revalidatePath('/admin/buildings'); // Revalidate the list page
    return { success: true, building: newBuilding };
  } catch (error: any) {
    console.error("Error creating building:", error);
    return { success: false, error: error.message || "Failed to create building." };
  }
}

export async function updateBuildingAction(id: string, data: Prisma.BuildingUpdateInput) {
  try {
    // Security: Prevent changing the manager via this action.
    // Manager assignment should be handled in user management.
    if ((data as any).managedByUserId) {
        delete (data as any).managedByUserId;
    }
    if ((data as any).manager) {
        delete (data as any).manager;
    }

    const updatedBuilding = await databaseService.updateBuilding(id, data);
    revalidatePath('/admin/buildings'); // Revalidate the list page
    revalidatePath(`/admin/buildings/upsert?id=${id}`); // Revalidate the edit page itself
    return { success: true, building: updatedBuilding };
  } catch (error: any) {
    console.error("Error updating building:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { // Record to update not found
        return { success: false, error: "Failed to update building. Record not found." };
      }
    }
    return { success: false, error: error.message || "Failed to update building." };
  }
}

export async function deleteBuildingAction(id: string) {
  try {
    // Check if building has spaces
    const buildingWithSpaces = await databaseService.getBuildingById(id, { spaces: { take: 1 } });
    if (buildingWithSpaces && buildingWithSpaces.spaces.length > 0) {
      return { success: false, error: "Cannot delete building with associated spaces. Please remove or reassign spaces first." };
    }
    // It's also good practice to check for other dependencies if they aren't handled by DB constraints (e.g., BuildingMonthlyUtilities)
    const buildingUtilities = await databaseService.getAllBuildingMonthlyUtilities({ where: { buildingId: id }, take: 1});
    if (buildingUtilities.length > 0) {
      return { success: false, error: "Cannot delete building with associated utility entries. Please remove them first." };
    }

    // Delete associated PenaltyTiers first
    await databaseService.deletePenaltyTiersByBuildingId(id);

    // Then delete the building
    await databaseService.deleteBuilding(id);
    revalidatePath('/admin/buildings'); // Revalidate the list page
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting building:", error);
     if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2003 is foreign key constraint failure, means it's still referenced somewhere not checked above.
      if (error.code === 'P2003' || error.code === 'P2014' ) {
         return { success: false, error: "Cannot delete this building as it's referenced by other records (e.g., spaces, utility entries, or agreements via spaces). Ensure all dependencies are removed." };
      }
       if (error.code === 'P2025') { // Record to delete not found
        return { success: false, error: "Failed to delete building. Record not found." };
      }
    }
    return { success: false, error: error.message || "Failed to delete building." };
  }
}
