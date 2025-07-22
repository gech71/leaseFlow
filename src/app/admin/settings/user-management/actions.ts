

"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma, type User, type Role } from '@prisma/client';
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
    const ACCESS_TOKEN_KEY = 'leaseflow_admin_access_token';
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_TOKEN_KEY)?.value;
    if (!accessToken) return null;
    
    const tokenPayload = await decodeJwtPayload(accessToken);
    if (!tokenPayload || !tokenPayload.sub) return null;

    return await databaseService.getUserByExternalId(tokenPayload.sub, { roles: true });
}

// Helper to get user and check permissions
async function getUserAndPermissions() {
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error("Authentication required.");

    const isSuperAdmin = currentUser.roles.some(r => r.name === 'SUPER_ADMIN');
    const permissions = new Set(currentUser.roles.flatMap(r => r.permissions));
    
    return { currentUser, isSuperAdmin, permissions };
}

export async function getUserManagementPageData() {
  try {
    // This data is intended for super admins or users with specific user management rights,
    // so we typically fetch all data and let the UI layer handle visibility.
    // However, a good practice could be to scope this down for non-super-admins if needed in the future.
    const users = await databaseService.getAllUsers({
      select: {
        id: true,
        userId: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        tempPassword: true, // Explicitly select tempPassword
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
  selectedRoleId: string | null, // Changed from string[] to string | null
  selectedManagedBuildingIds: string[]
) {
  try {
    const { isSuperAdmin, permissions } = await getUserAndPermissions();
    if (!isSuperAdmin && !permissions.has('settings:user_management:assign')) {
        return { success: false, error: "Permission denied." };
    }

    // 1. Update role for the user
    await databaseService.updateUser(targetUserId, {
      roles: selectedRoleId ? { set: [{ id: selectedRoleId }] } : { set: [] }, // Handle single role or no role
    });

    // 2. Update managed buildings
    const userToUpdate = await databaseService.getUserById(targetUserId);
    if (!userToUpdate) {
        throw new Error("User not found with internal ID.");
    }
    const identityUserId = userToUpdate.userId;

    const currentlyManagedBuildings = await databaseService.getAllBuildings({
      where: { managedByUserId: identityUserId }
    });

    const buildingsToUnassign = currentlyManagedBuildings.filter(
      b => !selectedManagedBuildingIds.includes(b.id)
    );
    for (const building of buildingsToUnassign) {
      await databaseService.updateBuilding(building.id, {
        manager: { disconnect: true }
      });
    }

    for (const buildingId of selectedManagedBuildingIds) {
      const isAlreadyManaged = currentlyManagedBuildings.some(b => b.id === buildingId && b.managedByUserId === identityUserId);
      if (!isAlreadyManaged) {
        await databaseService.updateBuilding(buildingId, {
          manager: { connect: { userId: identityUserId } }
        });
      }
    }

    revalidatePath('/admin/settings/user-management');
    revalidatePath('/admin/buildings'); // Revalidate in case manager assignments changed
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
