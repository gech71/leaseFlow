

"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma, type User, type Role } from '@prisma/client';
import { cookies, headers } from 'next/headers';
import { getUserAndPermissions } from '@/lib/actions/server-helpers';
import { prisma } from '@/lib/prisma';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;
const ADMIN_ACCESS_TOKEN_KEY = 'leaseflow_admin_access_token';


export async function getUserManagementPageData() {
  try {
    const users = await databaseService.getAllUsers({
      select: {
        id: true,
        userId: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        tempPassword: true,
        createdAt: true,
        updatedAt: true,
        roles: true, 
        managedBuildings: true,
      },
      orderBy: { createdAt: 'desc' }
    });
    const allRoles = await databaseService.getAllRoles({ orderBy: { name: 'asc' } });
    const allBuildings = await databaseService.getAllBuildings({ orderBy: { name: 'asc' } });
    
    return { success: true, users, allRoles, allBuildings };
  } catch (error: any) {
    console.error("Error fetching user management data:", error);
    return { success: false, error: error.message || "Failed to fetch data.", users: [], allRoles: [], allBuildings: [] };
  }
}

export async function updateUserAssignments(
  targetUserId: string,
  selectedRoleId: string | null,
  selectedManagedBuildingIds: string[]
) {
  try {
    const { isSuperAdmin, permissions } = await getUserAndPermissions();
    if (!isSuperAdmin && !permissions.has('settings:user_management:assign')) {
        return { success: false, error: "Permission denied." };
    }
    
    await prisma.user.update({
        where: { id: targetUserId },
        data: {
            roles: selectedRoleId ? { set: [{ id: selectedRoleId }] } : { set: [] },
            managedBuildings: {
                set: selectedManagedBuildingIds.map(id => ({ id: id }))
            }
        }
    });

    revalidatePath('/admin/settings/user-management');
    revalidatePath('/admin/buildings');
    return { success: true, message: "User assignments updated successfully." };

  } catch (error: any) {
    console.error("Error updating user assignments:", error);
    let errorMessage = "Failed to update user assignments.";
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      errorMessage = `A database error occurred: ${error.message}`;
    } else if (error.message) {
      errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
}


export async function updateUserNamesAction(
  userId: string,
  data: {
    firstName: string;
    lastName: string;
  }
): Promise<{ success: boolean; error?: string }> {
    if (!AUTH_API_BASE_URL) {
        console.error("Auth API base URL is not configured.");
        return { success: false, error: "Authentication service is not configured." };
    }
  try {
    const { isSuperAdmin, permissions } = await getUserAndPermissions();
    if (!isSuperAdmin && !permissions.has('settings:user_management:assign')) {
      return { success: false, error: "Permission denied." };
    }

    const adminAccessToken = cookies().get(ADMIN_ACCESS_TOKEN_KEY)?.value;
    if (!adminAccessToken) {
        return { success: false, error: "Admin authentication token not found." };
    }

    const localUserToUpdate = await databaseService.getUserById(userId);
    if (!localUserToUpdate) {
        return { success: false, error: "User not found." };
    }
    
    // Step 1: Update the external identity provider for names
    const externalResponse = await fetch(`${AUTH_API_BASE_URL}/api/Auth/update-user`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminAccessToken}`,
        },
        body: JSON.stringify({
            currentPhoneNumber: localUserToUpdate.phoneNumber, 
            newPhoneNumber: localUserToUpdate.phoneNumber,   // Keep phone number the same
            firstName: data.firstName,
            lastName: data.lastName,
        }),
    });

    if (!externalResponse.ok) {
        const errorData = await externalResponse.json().catch(() => ({ errors: ["Failed to update user name on identity server."] }));
        return { success: false, error: errorData.errors?.join(', ') || 'An unknown error occurred on the identity server.' };
    }
    
    // Step 2: Update local DB
    await databaseService.updateUser(userId, {
        firstName: data.firstName,
        lastName: data.lastName,
        name: `${data.firstName} ${data.lastName}`.trim(),
    });
    
    const tenantProfile = await databaseService.findTenantByEmailOrPhone(localUserToUpdate.email, localUserToUpdate.phoneNumber);
    if (tenantProfile) {
        await databaseService.updateTenant(tenantProfile.id, { name: `${data.firstName} ${data.lastName}`.trim() });
    }

    revalidatePath('/admin/settings/user-management');
    return { success: true };

  } catch (error: any) {
    console.error("Error in updateUserNamesAction:", error);
    return { success: false, error: error.message || "Failed to update user names." };
  }
}


export async function changeUserPhoneNumberAction(
  userId: string,
  newPhoneNumber: string
): Promise<{ success: boolean; error?: string }> {
  if (!AUTH_API_BASE_URL) {
        console.error("Auth API base URL is not configured.");
        return { success: false, error: "Authentication service is not configured." };
    }
  try {
    const { isSuperAdmin, permissions } = await getUserAndPermissions();
    if (!isSuperAdmin && !permissions.has('settings:user_management:assign')) {
      return { success: false, error: "Permission denied." };
    }

    const adminAccessToken = cookies().get(ADMIN_ACCESS_TOKEN_KEY)?.value;
    if (!adminAccessToken) {
        return { success: false, error: "Admin authentication token not found." };
    }

    const localUserToUpdate = await databaseService.getUserById(userId);
    if (!localUserToUpdate || !localUserToUpdate.phoneNumber) {
        return { success: false, error: "User not found or current phone number is missing." };
    }

    // Step 1: Call external service to change the phone number
    const externalResponse = await fetch(`${AUTH_API_BASE_URL}/api/Auth/change-phone-number`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        currentPhoneNumber: localUserToUpdate.phoneNumber,
        newPhoneNumber: newPhoneNumber,
      }),
    });

    if (!externalResponse.ok) {
      const errorData = await externalResponse.json().catch(() => ({ errors: ["Failed to change phone number on identity server."] }));
      return { success: false, error: errorData.errors?.join(', ') || 'An unknown error occurred.' };
    }
    
    // Step 2: Update the local database
    await databaseService.updateUser(userId, {
      phoneNumber: newPhoneNumber,
    });
    
    const tenantProfile = await databaseService.findTenantByEmailOrPhone(null, localUserToUpdate.phoneNumber);
    if (tenantProfile) {
      await databaseService.updateTenant(tenantProfile.id, {
        phone: newPhoneNumber,
      });
    }

    revalidatePath('/admin/settings/user-management');
    return { success: true };

  } catch (error: any) {
    console.error("Error in changeUserPhoneNumberAction:", error);
    return { success: false, error: error.message || "Failed to change phone number." };
  }
}
