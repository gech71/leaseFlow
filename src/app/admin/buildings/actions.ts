
"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import type { Prisma } from '@prisma/client';

export async function createBuildingAction(data: Prisma.BuildingCreateInput) {
  try {
    const newBuilding = await databaseService.createBuilding(data);
    revalidatePath('/admin/buildings'); // Revalidate the list page
    return { success: true, building: newBuilding };
  } catch (error: any) {
    console.error("Error creating building:", error);
    // Consider more specific error handling if Prisma throws known errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') { // Unique constraint violation
        return { success: false, error: `Failed to create building. A building with similar unique fields (e.g., name) might already exist.` };
      }
    }
    return { success: false, error: error.message || "Failed to create building." };
  }
}

export async function updateBuildingAction(id: string, data: Prisma.BuildingUpdateInput) {
  try {
    const updatedBuilding = await databaseService.updateBuilding(id, data);
    revalidatePath('/admin/buildings'); // Revalidate the list page
    revalidatePath(`/admin/buildings/upsert?id=${id}`); // Revalidate the edit page itself
    return { success: true, building: updatedBuilding };
  } catch (error: any) {
    console.error("Error updating building:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return { success: false, error: `Failed to update building. A building with similar unique fields (e.g., name) might already exist.` };
      }
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
    const buildingWithSpaces = await databaseService.getBuildingById(id, { include: { spaces: { take: 1 } } });
    if (buildingWithSpaces && buildingWithSpaces.spaces.length > 0) {
      return { success: false, error: "Cannot delete building with associated spaces. Please remove or reassign spaces first." };
    }
    // It's also good practice to check for other dependencies if they aren't handled by DB constraints (e.g., BuildingMonthlyUtilities)
    const buildingUtilities = await databaseService.getAllBuildingMonthlyUtilities({ where: { buildingId: id }, take: 1});
    if (buildingUtilities.length > 0) {
      return { success: false, error: "Cannot delete building with associated utility entries. Please remove them first." };
    }


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
