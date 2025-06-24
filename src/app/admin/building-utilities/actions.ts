
"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma, type Building, type BuildingMonthlyUtilities, type User, type Role } from '@prisma/client';
import { cookies } from 'next/headers';

// Insecure JWT payload decoder
async function decodeJwtPayload(token: string): Promise<any | null> {
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
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_TOKEN_KEY)?.value;
    if (!accessToken) return null;
    
    const tokenPayload = await decodeJwtPayload(accessToken);
    if (!tokenPayload || !tokenPayload.sub) return null;

    return await databaseService.getUserByExternalId(tokenPayload.sub, { roles: true });
}

async function getUserAndManagedIds() {
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error("Authentication required.");

    const isSuperAdmin = currentUser.roles.some(role => role.name === 'SUPER_ADMIN');
    let managedBuildingIds: string[] | null = null; // null means all access for super admin

    if (!isSuperAdmin) {
        const managedBuildings = await databaseService.getAllBuildings({ where: { managedByUserId: currentUser.userId } });
        managedBuildingIds = managedBuildings.map(b => b.id);
    }
    return { currentUser, isSuperAdmin, managedBuildingIds };
}

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
    const { isSuperAdmin, managedBuildingIds } = await getUserAndManagedIds();

    if (!isSuperAdmin && managedBuildingIds?.length === 0) {
       return []; // No buildings, so no utility records
    }
    const whereClause = !isSuperAdmin ? { buildingId: { in: managedBuildingIds! } } : {};

    return await databaseService.getAllBuildingMonthlyUtilities({
      where: whereClause,
      include: { utilities: true, building: { select: { name: true }} },
      orderBy: { createdAt: 'desc' },
    });
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

    