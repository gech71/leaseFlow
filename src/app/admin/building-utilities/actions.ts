
"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma, type Building, type BuildingMonthlyUtilities } from '@prisma/client';

export async function getRegisteredBuildingsAction(): Promise<Building[]> {
  try {
    return await databaseService.getAllBuildings({ orderBy: { name: 'asc' } });
  } catch (error: any) {
    console.error("Error fetching buildings:", error);
    return []; // Return empty array on error, client can handle this
  }
}

export async function getBuildingUtilitiesAction(
  buildingId: string,
  year: number,
  month: number
): Promise<BuildingMonthlyUtilities | null> {
  try {
    // Corrected: Pass the include options directly
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
    return { success: true, data: result };
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
    return await databaseService.getAllBuildingMonthlyUtilities({
      include: { utilities: true, building: { select: { name: true }} },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { buildingName: 'asc' }],
    });
  } catch (error: any) {
    console.error("Error fetching all building utilities:", error);
    return [];
  }
}

