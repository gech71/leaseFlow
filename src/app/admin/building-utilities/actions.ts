
"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma, type Building, type BuildingMonthlyUtilities, type User, type Role } from '@prisma/client';
import { cookies } from 'next/headers';

// Insecure JWT payload decoder
function decodeJwtPayload(token: string): any | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Failed to decode JWT payload:', e);
    return null;
  }
}

// Gets current user from cookie
async function getCurrentUser(): Promise<(User & { roles: Role[] }) | null> {
    const ACCESS_TOKEN_KEY = 'leaseflow_access_token';
    const cookieStore = cookies();
    const accessToken = cookieStore.get(ACCESS_TOKEN_KEY)?.value;
    if (!accessToken) return null;
    
    const tokenPayload = decodeJwtPayload(accessToken);
    if (!tokenPayload || !tokenPayload.sub) return null;

    return await databaseService.getUserByExternalId(tokenPayload.sub, { roles: true });
}

export async function getRegisteredBuildingsAction(): Promise<Building[]> {
  try {
    const currentUser = await getCurrentUser();
    const isSuperAdmin = currentUser?.roles.some(role => role.name === 'SUPER_ADMIN') ?? false;
    let managedBuildingIds: string[] | undefined = undefined;

    if (!isSuperAdmin && currentUser) {
        const managedBuildings = await databaseService.getAllBuildings({ where: { managedByUserId: currentUser.userId } });
        managedBuildingIds = managedBuildings.map(b => b.id);
        if (managedBuildingIds.length === 0) {
            managedBuildingIds = ['-1']; // Non-existent ID to return no results
        }
    }
    const whereClause = managedBuildingIds ? { id: { in: managedBuildingIds } } : {};

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
    const currentUser = await getCurrentUser();
    const isSuperAdmin = currentUser?.roles.some(role => role.name === 'SUPER_ADMIN') ?? false;
    let managedBuildingIds: string[] | undefined = undefined;

    if (!isSuperAdmin && currentUser) {
        const managedBuildings = await databaseService.getAllBuildings({ where: { managedByUserId: currentUser.userId } });
        managedBuildingIds = managedBuildings.map(b => b.id);
        if (managedBuildingIds.length === 0) {
           return []; // No buildings, so no utility records
        }
    }
    const whereClause = managedBuildingIds ? { buildingId: { in: managedBuildingIds } } : {};

    return await databaseService.getAllBuildingMonthlyUtilities({
      where: whereClause,
      include: { utilities: true, building: { select: { name: true }} },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { buildingName: 'asc' }],
    });
  } catch (error: any) {
    console.error("Error fetching all building utilities:", error);
    return [];
  }
}

export async function deleteBuildingUtilitiesAction(id: string) {
  try {
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
