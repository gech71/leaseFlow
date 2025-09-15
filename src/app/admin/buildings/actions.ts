

"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma, type User, type Role } from '@prisma/client';
import { cookies } from 'next/headers';
import { getUserAndPermissions } from '@/lib/actions/server-helpers';

export async function createBuildingAction(data: Prisma.BuildingCreateInput) {
  try {
    const newBuilding = await databaseService.createBuilding(data);
    revalidatePath('/admin/buildings');
    return { success: true, building: newBuilding };
  } catch (error: any) {
    console.error("Error creating building:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002' && error.meta?.target === 'Building_accountNumber_key') {
        return { success: false, error: "This account number is already in use by another building." };
      }
    }
    return { success: false, error: error.message || "Failed to create building." };
  }
}

export async function updateBuildingAction(
  id: string, 
  data: Prisma.BuildingUpdateInput,
  managerIds?: string[]
) {
  try {
    // This is the correct way to handle relation updates in Prisma
    if (managerIds !== undefined) {
      data.managers = {
        set: managerIds.map(id => ({ id }))
      };
    }

    const updatedBuilding = await databaseService.updateBuilding(id, data);
    revalidatePath('/admin/buildings');
    revalidatePath(`/admin/buildings/add-building?id=${id}`);
    revalidatePath('/admin/settings/user-management');
    return { success: true, building: updatedBuilding };
  } catch (error: any) {
    console.error("Error updating building:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return { success: false, error: "Failed to update building. Record not found." };
      }
      if (error.code === 'P2002' && error.meta?.target === 'Building_accountNumber_key') {
        return { success: false, error: "This account number is already in use by another building." };
      }
    }
    return { success: false, error: error.message || "Failed to update building." };
  }
}

export async function deleteBuildingAction(id: string) {
  try {
    const buildingWithSpaces = await databaseService.getBuildingById(id, { spaces: { take: 1 } });
    if (buildingWithSpaces && buildingWithSpaces.spaces.length > 0) {
      return { success: false, error: "Cannot delete building with associated spaces. Please remove or reassign spaces first." };
    }
    const buildingUtilities = await databaseService.getAllBuildingMonthlyUtilities({ where: { buildingId: id }, take: 1});
    if (buildingUtilities.length > 0) {
      return { success: false, error: "Cannot delete building with associated utility entries. Please remove them first." };
    }

    await databaseService.deletePenaltyTiersByBuildingId(id);

    await databaseService.deleteBuilding(id);
    revalidatePath('/admin/buildings');
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting building:", error);
     if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2003' || error.code === 'P2014' ) {
         return { success: false, error: "Cannot delete this building as it's referenced by other records (e.g., spaces, utility entries, or agreements via spaces). Ensure all dependencies are removed." };
      }
       if (error.code === 'P2025') {
        return { success: false, error: "Failed to delete building. Record not found." };
      }
    }
    return { success: false, error: error.message || "Failed to delete building." };
  }
}
