

"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma, type User, type Role, BuildingStatus } from '@prisma/client';
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

export async function toggleBuildingStatusAction(buildingId: string, newStatus: BuildingStatus) {
    try {
        const { permissions, isSuperAdmin } = await getUserAndPermissions();
        if (!isSuperAdmin && !permissions.has('building:edit')) {
            return { success: false, error: "You do not have permission to change a building's status." };
        }

        if (newStatus === 'Inactive') {
            const buildingWithSpaces = await databaseService.getBuildingById(buildingId, { spaces: { where: { isOccupied: true }, take: 1 } });
            if (buildingWithSpaces && buildingWithSpaces.spaces.length > 0) {
                return { success: false, error: "Cannot deactivate a building with occupied spaces. Please ensure all spaces are vacant first." };
            }
        }

        const updatedBuilding = await databaseService.updateBuilding(buildingId, { status: newStatus });
        revalidatePath('/admin/buildings');
        return { success: true, building: updatedBuilding };

    } catch (error: any) {
        console.error(`Error changing building status for ${buildingId}:`, error);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          return { success: false, error: "Building not found." };
        }
        return { success: false, error: `Failed to set building status to ${newStatus}.` };
    }
}
