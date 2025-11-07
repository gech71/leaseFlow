"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma, type User, type Role } from '@prisma/client';
import { cookies, headers } from 'next/headers';
import { getUserAndPermissions, getUserAndManagedIds } from '@/lib/actions/server-helpers';
import { prisma } from '@/lib/prisma';
import bcrypt from "bcrypt";



export async function getUserManagementPageData() {
  try {
    const { isSuperAdmin, managedBuildingIds, currentUser } = await getUserAndManagedIds();

    let userWhereClause: Prisma.UserWhereInput = {};

    // ** FIX: Corrected filtering logic for non-superadmins **
    if (!isSuperAdmin) {
        // 1. Get IDs of tenants created by this admin
        const createdTenants = await prisma.tenant.findMany({
            where: { createdById: currentUser.id },
            select: { userId: true }
        });
        
        // Filter out any null/undefined userIds and create a list of unique IDs
        const createdTenantUserIds = [...new Set(createdTenants.map(t => t.userId).filter(Boolean) as string[])];

        // 2. Build the WHERE clause
        // A non-superadmin can see:
        //  - Users they directly created (for staff)
        //  - Users associated with tenants they created
        userWhereClause = {
            OR: [
                { createdById: currentUser.id },
                { id: { in: createdTenantUserIds } }
            ]
        };
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
        createdUsers: true,
        createdById: true,
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
        firstName: data.firstName,
        lastName: data.lastName,
        name: `${data.firstName} ${data.lastName}`.trim(),
    });
    
    const tenantProfile = await databaseService.findTenantByEmailOrPhone(userToUpdate.email, userToUpdate.phoneNumber);
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
  try {
    const { isSuperAdmin, permissions } = await getUserAndPermissions();
    if (!isSuperAdmin && !permissions.has('settings:user_management:assign')) {
      return { success: false, error: "Permission denied." };
    }

    const localUserToUpdate = await databaseService.getUserById(userId);
    if (!localUserToUpdate || !localUserToUpdate.phoneNumber) {
        return { success: false, error: "User not found or current phone number is missing." };
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

export async function resetPasswordAction(userId: string): Promise<{ success: boolean; error?: string; tempPassword?: string }> {
    try {
        const { isSuperAdmin, permissions, currentUser: adminUser } = await getUserAndPermissions();
        if (!isSuperAdmin && !permissions.has('settings:user_management:assign')) {
            return { success: false, error: "Permission denied to reset passwords." };
        }
        
        const userToReset = await databaseService.getUserById(userId, { roles: true });
        if (!userToReset) {
            return { success: false, error: "User not found." };
        }

        // Security check: Admins cannot reset other super admins. Only a super admin can reset their own password via profile page.
        if (userToReset.roles.some(r => r.name === 'SUPER_ADMIN') && userToReset.id !== adminUser.id) {
            return { success: false, error: "Super Admin passwords can only be changed via their own profile page." };
        }
        
        const tempPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        
        await databaseService.updateUser(userId, {
            password: hashedPassword,
            tempPassword: tempPassword,
        });

        revalidatePath('/admin/settings/user-management');
        return { success: true, tempPassword: tempPassword };
    } catch(e: any) {
        return { success: false, error: "Failed to reset password." };
    }
}
