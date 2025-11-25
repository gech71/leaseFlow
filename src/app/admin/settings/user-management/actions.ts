

"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma, type User, type Role } from '@prisma/client';
import { cookies, headers } from 'next/headers';
import { getUserAndPermissions, getUserAndManagedIds } from '@/lib/actions/server-helpers';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

const ADMIN_ACCESS_TOKEN_KEY = 'nibrental_admin_access_token';


export async function getUserManagementPageData() {
  try {
    const { isSuperAdmin, managedBuildingIds, currentUser } = await getUserAndManagedIds();

    let userWhereClause: Prisma.UserWhereInput = {};

    // Non-superadmins can see users they created and tenants in buildings they manage
    if (!isSuperAdmin) {
        const createdUserIds = (await prisma.user.findMany({
            where: { createdById: currentUser.id },
            select: { id: true }
        })).map(u => u.id);

        const tenantUserIdsInManagedBuildings = (await prisma.tenant.findMany({
            where: {
                agreements: {
                    some: {
                        space: {
                            buildingId: { in: managedBuildingIds }
                        }
                    }
                }
            },
            select: { userId: true }
        })).map(t => t.userId).filter((id): id is string => !!id);
        
        const allVisibleUserIds = [...new Set([...createdUserIds, ...tenantUserIdsInManagedBuildings])];

        userWhereClause = { id: { in: allVisibleUserIds } };
    }


    const users = await databaseService.getAllUsers({
      where: userWhereClause,
      select: {
        id: true,
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

    // Apply role filtering logic
    let roleWhereClause: Prisma.RoleWhereInput = {};
    if (!isSuperAdmin) {
        // Normal users can only assign roles they have created, plus the TENANT role.
        roleWhereClause = { 
            OR: [
                {
                    name: { notIn: ['SUPER_ADMIN'] },
                    createdById: currentUser.id
                },
                {
                    name: 'TENANT'
                }
            ]
        };
    }
    const allRoles = await databaseService.getAllRoles({ where: roleWhereClause, orderBy: { name: 'asc' } });
    
    // Non-super-admins should only see the buildings they can manage to assign
    const buildingWhereClause: Prisma.BuildingWhereInput = !isSuperAdmin ? { id: { in: managedBuildingIds ?? [] } } : {};
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
  try {
    const { isSuperAdmin, permissions } = await getUserAndPermissions();
    if (!isSuperAdmin && !permissions.has('settings:user_management:assign')) {
      return { success: false, error: "Permission denied." };
    }
    
    await databaseService.updateUser(userId, {
        firstName: data.firstName,
        lastName: data.lastName,
        name: `${data.firstName} ${data.lastName}`.trim(),
    });
    
    const localUserToUpdate = await databaseService.getUserById(userId);
    if (localUserToUpdate) {
        const tenantProfile = await databaseService.findTenantByEmailOrPhone(localUserToUpdate.email, localUserToUpdate.phoneNumber);
        if (tenantProfile) {
            await databaseService.updateTenant(tenantProfile.id, { name: `${data.firstName} ${data.lastName}`.trim() });
        }
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
    
    const userToUpdate = await databaseService.getUserById(userId);
    if (!userToUpdate) {
        return { success: false, error: "User not found." };
    }

    await databaseService.updateUser(userId, {
      phoneNumber: newPhoneNumber,
    });
    
    const tenantProfile = await databaseService.findTenantByEmailOrPhone(null, userToUpdate.phoneNumber);
    if (tenantProfile) {
      await databaseService.updateTenant(tenantProfile.id, {
        phone: newPhoneNumber,
      });
    }

    revalidatePath('/admin/settings/user-management');
    return { success: true };

  } catch (error: any) {
    console.error("Error in changeUserPhoneNumberAction:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { success: false, error: "This phone number is already in use by another user." };
    }
    return { success: false, error: error.message || "Failed to change phone number." };
  }
}
    
function generateTempPassword(length = 12): string {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const allChars = upper + lower + numbers + symbols;

    let password = '';
    const randomValues = new Uint32Array(length);
    crypto.getRandomValues(randomValues);

    // Ensure at least one of each character type
    password += upper[randomValues[0] % upper.length];
    password += lower[randomValues[1] % lower.length];
    password += numbers[randomValues[2] % numbers.length];
    password += symbols[randomValues[3] % symbols.length];

    // Fill the rest of the password
    for (let i = 4; i < length; i++) {
        password += allChars[randomValues[i] % allChars.length];
    }
    
    // Shuffle the password to avoid predictable patterns
    return password.split('').sort(() => 0.5 - (crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296)).join('');
}


export async function resetUserPasswordAction(
  userId: string
): Promise<{ success: boolean; tempPassword?: string; error?: string }> {
  try {
    const { isSuperAdmin, permissions } = await getUserAndPermissions();
    if (!isSuperAdmin && !permissions.has('settings:user_management:assign')) {
      return { success: false, error: "Permission denied." };
    }
    
    const tempPassword = generateTempPassword();
    
    await databaseService.updateUser(userId, {
      password: null, // Remove the main password
      tempPassword: tempPassword, // Store the plain temporary password
    });
    
    revalidatePath('/admin/settings/user-management');
    return { success: true, tempPassword };
  } catch (error: any) {
    console.error("Error resetting user password:", error);
    return { success: false, error: "Failed to reset password." };
  }
}
