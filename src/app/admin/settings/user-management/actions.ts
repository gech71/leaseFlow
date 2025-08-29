

"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma, type User, type Role } from '@prisma/client';
import { cookies } from 'next/headers';
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


export async function updateUserDetailsAction(
  userId: string,
  data: {
    firstName: string;
    lastName: string;
    phoneNumber: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { isSuperAdmin, permissions } = await getUserAndPermissions();
    if (!isSuperAdmin && !permissions.has('settings:user_management:assign')) {
      return { success: false, error: "Permission denied." };
    }
    
    const requestHeaders = new Headers(cookies().toString());

    // We call our own internal API route, which then calls the external service.
    // This ensures cookies are forwarded correctly.
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/Auth/update-user`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': cookies().toString(),
        },
        body: JSON.stringify({
            userId: userId,
            ...data
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ errors: ["Failed to update user."] }));
        return { success: false, error: errorData.errors?.join(', ') || 'An unknown error occurred.' };
    }

    revalidatePath('/admin/settings/user-management');
    return { success: true };

  } catch (error: any) {
    console.error("Error in updateUserDetailsAction:", error);
    return { success: false, error: error.message || "Failed to update user details." };
  }
}
