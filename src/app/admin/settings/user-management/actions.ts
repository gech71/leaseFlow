

"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma, type User, type Role } from '@prisma/client';
import { cookies, headers } from 'next/headers';
import { getUserAndPermissions } from '@/lib/actions/server-helpers';
import { prisma } from '@/lib/prisma';


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
  try {
    const { isSuperAdmin, permissions } = await getUserAndPermissions();
    if (!isSuperAdmin && !permissions.has('settings:user_management:assign')) {
      return { success: false, error: "Permission denied." };
    }
    
    const requestHeaders = headers();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

    if (!baseUrl) {
      console.error("Error updating user details: NEXT_PUBLIC_BASE_URL is not set.");
      return { success: false, error: "Application base URL is not configured." };
    }
    
    const response = await fetch(`${baseUrl}/api/Auth/update-user`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': requestHeaders.get('Cookie') || "", 
        },
        body: JSON.stringify({
            userId: userId,
            ...data
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ errors: ["Failed to update user names."] }));
        return { success: false, error: errorData.errors?.join(', ') || 'An unknown error occurred.' };
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
  try {
    const { isSuperAdmin, permissions } = await getUserAndPermissions();
    if (!isSuperAdmin && !permissions.has('settings:user_management:assign')) {
      return { success: false, error: "Permission denied." };
    }

    const localUserToUpdate = await databaseService.getUserById(userId);
    if (!localUserToUpdate || !localUserToUpdate.phoneNumber) {
        return { success: false, error: "User not found or current phone number is missing." };
    }

    // Step 1: Call external service to change the phone number
    const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;
    const requestHeaders = headers();

    const externalResponse = await fetch(`${AUTH_API_BASE_URL}/api/Auth/change-phone-number`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${requestHeaders.get('Authorization')?.split(' ')[1] || cookies().get(ADMIN_ACCESS_TOKEN_KEY)?.value}`
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
