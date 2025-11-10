
"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma, type Building, type BuildingMonthlyUtilities, type User, type Role } from '@prisma/client';
import { cookies } from 'next/headers';
import { getUserAndManagedIds } from '@/lib/actions/server-helpers';

export async function getRegisteredBuildingsAction(): Promise<Building[]> {
  try {
    const { isSuperAdmin, managedBuildingIds } = await getUserAndManagedIds();
    
    if (!isSuperAdmin && managedBuildingIds?.length === 0) {
        return [];
    }

    const whereClause = !isSuperAdmin ? { id: { in: managedBuildingIds! } } : {};

    return await databaseService.getAllBuildings({ 
      where: whereClause,
      orderBy: { name: 'asc' },
      include: { spaces: { orderBy: { spaceIdName: 'asc' } } }
    });
  } catch (error: any) {
    console.error("Error fetching buildings:", error);
    return [];
  }
}

export async function getBuildingUtilitiesAction(
  buildingId: string,
  year: number,
  month: number
): Promise<(BuildingMonthlyUtilities & { utilities: { totalCost: number }[] }) | null> {
  try {
    const { isSuperAdmin, managedBuildingIds } = await getUserAndManagedIds();
    if (!isSuperAdmin && !managedBuildingIds?.includes(buildingId)) {
        console.warn(`Permission denied: User tried to access utilities for unmanaged building ${buildingId}`);
        return null;
    }

    const utilities = await databaseService.getBuildingMonthlyUtilitiesByBuildingMonthYear(buildingId, month, year, {
      utilities: true,
    });

    if (!utilities) return null;

    const serializableUtilities = {
      ...utilities,
      utilities: utilities.utilities.map(u => ({
        ...u,
        totalCost: Number(u.totalCost)
      }))
    };
    
    return serializableUtilities;

  } catch (error: any) {
    console.error("Error fetching building utilities:", error);
    return null;
  }
}

export interface BuildingUtilityItemInput {
  name: string;
  totalCost: number;
  appliesToScope: 'Building' | 'Floor' | 'SpecificSpaces';
  applicableFloor?: string | null;
  applicableSpaceIdNames?: string[] | null;
}

export async function saveBuildingUtilitiesAction(
  buildingId: string,
  buildingName: string,
  year: number,
  month: number,
  utilityItems: BuildingUtilityItemInput[]
) {
  try {
    const { isSuperAdmin, managedBuildingIds } = await getUserAndManagedIds();
    if (!isSuperAdmin && !managedBuildingIds?.includes(buildingId)) {
        return { success: false, error: "Permission denied." };
    }

    const where: Prisma.BuildingMonthlyUtilitiesWhereUniqueInput = {
      buildingId_year_month: {
        buildingId,
        year,
        month,
      },
    };

    const utilityItemsCreateData = utilityItems.map(item => ({
      name: item.name,
      totalCost: item.totalCost,
      appliesToScope: item.appliesToScope,
      applicableFloor: item.appliesToScope === 'Floor' ? item.applicableFloor : null,
      applicableSpaceIdNames: item.appliesToScope === 'SpecificSpaces' ? (item.applicableSpaceIdNames || []) : [],
    }));

    const createData: Prisma.BuildingMonthlyUtilitiesCreateInput = {
      building: { connect: { id: buildingId } },
      buildingName,
      year,
      month,
      utilities: {
        create: utilityItemsCreateData,
      },
    };

    const updateData: Prisma.BuildingMonthlyUtilitiesUpdateInput = {
      utilities: {
        deleteMany: {},
        create: utilityItemsCreateData,
      },
    };

    const result = await databaseService.upsertBuildingMonthlyUtilities(
      where, 
      createData, 
      updateData, 
      {
        utilities: true 
      }
    );

    revalidatePath('/admin/building-utilities');
    revalidatePath('/admin/billing');
    
    const serializableResult = {
      ...result,
      utilities: result.utilities.map(u => ({
        ...u,
        totalCost: Number(u.totalCost)
      }))
    };

    return { success: true, data: serializableResult };
  } catch (error: any) {
    console.error("Error saving building utilities:", error);
    let errorMessage = "Failed to save utility data.";
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      errorMessage = `Database error: ${error.message}`;
    } else if (error.message) {
      errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
}

export async function getAllBuildingUtilitiesForListAction(): Promise<(BuildingMonthlyUtilities & { utilities: { totalCost: number }[] })[]> {
  try {
    const { isSuperAdmin, managedBuildingIds } = await getUserAndManagedIds();

    if (!isSuperAdmin && managedBuildingIds?.length === 0) {
       return [];
    }
    const whereClause = !isSuperAdmin ? { buildingId: { in: managedBuildingIds! } } : {};

    const records = await databaseService.getAllBuildingMonthlyUtilities({
      where: whereClause,
      include: { utilities: true, building: { select: { name: true }} },
      orderBy: { createdAt: 'desc' },
    });
    
    const serializedRecords = records.map(record => ({
      ...record,
      utilities: record.utilities.map(util => ({
        ...util,
        totalCost: Number(util.totalCost)
      }))
    }));
    
    return serializedRecords as (BuildingMonthlyUtilities & { utilities: { totalCost: number }[] })[];

  } catch (error: any) {
    console.error("Error fetching all building utilities:", error);
    return [];
  }
}

export async function deleteBuildingUtilitiesAction(id: string) {
  try {
    const { isSuperAdmin, managedBuildingIds } = await getUserAndManagedIds();
    
    const recordToDelete = await databaseService.getBuildingMonthlyUtilitiesById(id);
    if (!recordToDelete) {
        return { success: false, error: "Utility record not found for deletion." };
    }

    if (!isSuperAdmin && !managedBuildingIds?.includes(recordToDelete.buildingId)) {
        return { success: false, error: "Permission denied." };
    }

    await databaseService.deleteBuildingMonthlyUtilities(id);
    revalidatePath('/admin/building-utilities');
    revalidatePath('/admin/billing');
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting building utilities:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return { success: false, error: "Utility record not found for deletion." };
    }
    return { success: false, error: error.message || "Failed to delete utility record." };
  }
}
