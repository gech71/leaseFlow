
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
): Promise<BuildingMonthlyUtilities | null> {
  try {
    const { isSuperAdmin, managedBuildingIds } = await getUserAndManagedIds();
    if (!isSuperAdmin && !managedBuildingIds?.includes(buildingId)) {
        console.warn(`Permission denied: User tried to access utilities for unmanaged building ${buildingId}`);
        return null; // Don't return data user can't access
    }

    return await databaseService.getBuildingMonthlyUtilitiesByBuildingMonthYear(buildingId, month, year, {
      utilities: true,
    });
  } catch (error: any) {
    console.error("Error fetching building utilities:", error);
    return null; // Return null on error
  }
}

export interface BuildingUtilityItemInput {
  name: string;
  totalCost: number;
  appliesToScope: 'Building' | 'Floor' | 'SpecificSpaces'; // Matches Prisma Enum
  applicableFloor?: string | null;
  applicableSpaceIdNames?: string[] | null;
}

export async function saveBuildingUtilitiesAction(
  buildingId: string,
  buildingName: string, // Denormalized name
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
      buildingId_year_month: { // Using the @@unique constraint name
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
        deleteMany: {}, // Delete all existing items for this period
        create: utilityItemsCreateData, // Create new ones
      },
      // buildingName could also be updated here if it can change, though less likely for this entity
    };

    const result = await databaseService.upsertBuildingMonthlyUtilities(
      where, 
      createData, 
      updateData, 
      { // Corrected: Pass include options directly
        utilities: true 
      }
    );

    revalidatePath('/admin/building-utilities');
    revalidatePath('/admin/billing'); // Billing page might depend on this data
    
    // Serialize the result to convert Decimal to number before returning to the client
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
      // More specific error messages can be added here based on error codes
      errorMessage = `Database error: ${error.message}`;
    } else if (error.message) {
      errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
}

export async function getAllBuildingUtilitiesForListAction(): Promise<BuildingMonthlyUtilities[]> {
  try {
    const { isSuperAdmin, managedBuildingIds } = await getUserAndManagedIds();

    if (!isSuperAdmin && managedBuildingIds?.length === 0) {
       return []; // No buildings, so no utility records
    }
    const whereClause = !isSuperAdmin ? { buildingId: { in: managedBuildingIds! } } : {};

    const records = await databaseService.getAllBuildingUtilities({
      where: whereClause,
      include: { utilities: true, building: { select: { name: true }} },
      orderBy: { createdAt: 'desc' },
    });
    
    // Correctly serialize the Decimal values to numbers before returning
    const serializedRecords = records.map(record => ({
      ...record,
      utilities: record.utilities.map(util => ({
        ...util,
        totalCost: Number(util.totalCost)
      }))
    }));
    
    return serializedRecords as unknown as BuildingMonthlyUtilities[];

  } catch (error: any) {
    console.error("Error fetching all building utilities:", error);
    return [];
  }
}

export async function deleteBuildingUtilitiesAction(id: string) {
  try {
    const { isSuperAdmin, managedBuildingIds } = await getUserAndManagedIds();
    
    // Fetch the record first to check for ownership
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
