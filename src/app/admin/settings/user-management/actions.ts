
"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma, type User, type Role } from '@prisma/client';
import { cookies, headers } from 'next/headers';
import { getUserAndPermissions, getUserAndManagedIds } from '@/lib/actions/server-helpers';
import { prisma } from '@/lib/prisma';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;
const ADMIN_ACCESS_TOKEN_KEY = 'nibrental_admin_access_token';


export async function getUserManagementPageData() {
  try {
    const { isSuperAdmin, managedBuildingIds, currentUser } = await getUserAndManagedIds();

    let userWhereClause: Prisma.UserWhereInput = {};
    if (!isSuperAdmin) {
      // Non-super-admins only see users they have created.
      userWhereClause = {
        createdById: currentUser.id
      };
    }

    const users = await databaseService.getAllUsers({
      where: userWhereClause,
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
        createdBy: true, // Include createdBy to show who created the user
        createdUsers: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    // Apply role filtering logic
    let roleWhereClause: Prisma.RoleWhereInput = {};
    if (!isSuperAdmin) {
        // Normal users can only assign roles they have created.
        roleWhereClause = { createdById: currentUser.id };
    }
    const allRoles = await databaseService.getAllRoles({ where: roleWhereClause, orderBy: { name: 'asc' } });
    
    // Non-super-admins should only see the buildings they can manage to assign
    const buildingWhereClause: Prisma.BuildingWhereInput = !isSuperAdmin ? { id: { in: managedBuildingIds } } : {};
    const allBuildings = await databaseService.getAllBuildings({ where: buildingWhereClause, orderBy: { name: 'asc' } });
    
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
    
    const updateData: Prisma.UserUpdateInput = {
        roles: selectedRoleId ? { set: [{ id: selectedRoleId }] } : { set: [] }
    };

    if (isSuperAdmin) {
        updateData.managedBuildings = {
            set: selectedManagedBuildingIds.map(id => ({ id: id }))
        };
    }

    await prisma.user.update({
        where: { id: targetUserId },
        data: updateData
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

    const adminAccessToken = (await cookies()).get(ADMIN_ACCESS_TOKEN_KEY)?.value;
    if (!adminAccessToken) {
        return { success: false, error: "Admin authentication token not found." };
    }

    const localUserToUpdate = await databaseService.getUserById(userId);
    if (!localUserToUpdate) {
        return { success: false, error: "User not found." };
    }
    
    const externalResponse = await fetch(`${AUTH_API_BASE_URL}/api/Auth/update-user`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminAccessToken}`,
        },
        body: JSON.stringify({
            phoneNumber: localUserToUpdate.phoneNumber,
            firstName: data.firstName,
            lastName: data.lastName,
        }),
    });

    if (!externalResponse.ok) {
        const errorData = await externalResponse.json().catch(() => ({ errors: ["Failed to update user name on identity server."] }));
        return { success: false, error: errorData.errors?.join(', ') || 'An unknown error occurred on the identity server.' };
    }
    
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

    const adminAccessToken = (await cookies()).get(ADMIN_ACCESS_TOKEN_KEY)?.value;
    if (!adminAccessToken) {
        return { success: false, error: "Admin authentication token not found." };
    }

    const localUserToUpdate = await databaseService.getUserById(userId);
    if (!localUserToUpdate || !localUserToUpdate.phoneNumber) {
        return { success: false, error: "User not found or current phone number is missing." };
    }

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

    
