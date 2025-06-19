
"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import type { Prisma } from '@prisma/client';

export async function createBuildingAction(data: Prisma.BuildingCreateInput) {
  try {
    const newBuilding = await databaseService.createBuilding(data);
    revalidatePath('/admin/buildings');
    return { success: true, building: newBuilding };
  } catch (error: any) {
    console.error("Error creating building:", error);
    return { success: false, error: error.message || "Failed to create building." };
  }
}

export async function updateBuildingAction(id: string, data: Prisma.BuildingUpdateInput) {
  try {
    const updatedBuilding = await databaseService.updateBuilding(id, data);
    revalidatePath('/admin/buildings');
    revalidatePath(`/admin/buildings/upsert?id=${id}`);
    return { success: true, building: updatedBuilding };
  } catch (error: any) {
    console.error("Error updating building:", error);
    return { success: false, error: error.message || "Failed to update building." };
  }
}

export async function deleteBuildingAction(id: string) {
  try {
    // Check if building has spaces, if so, prevent deletion or handle accordingly
    const buildingWithSpaces = await databaseService.getBuildingById(id, { include: { spaces: true } });
    if (buildingWithSpaces && buildingWithSpaces.spaces.length > 0) {
      return { success: false, error: "Cannot delete building with associated spaces. Please remove spaces first." };
    }
    await databaseService.deleteBuilding(id);
    revalidatePath('/admin/buildings');
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting building:", error);
    // Check for specific Prisma error for foreign key constraint violation if needed
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
         return { success: false, error: "Cannot delete this building as it's referenced by other records (e.g., spaces, utility entries)." };
    }
    return { success: false, error: error.message