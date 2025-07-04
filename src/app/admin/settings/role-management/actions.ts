
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

// Helper to get user and check for super admin status
async function getIsSuperAdmin() {
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error("Authentication required.");
    return currentUser.roles.some(r => r.name === 'SUPER_ADMIN');
}

export async function getAllRolesAction(): Promise<{ success: boolean, roles?: Role[], error?: string }> {
  try {
    const roles = await databaseService.getAllRoles({ orderBy: { name: 'asc' } });
    return { success: true, roles };
  } catch (error: any) {
    console.error("Error fetching roles:", error);
    return { success: false, error: error.message || "Failed to fetch roles." };
  }
}

export interface RoleUpsertData {
  name: string;
  description?: string;
  permissions: string[];
}

export async function createRoleAction(data: RoleUpsertData): Promise<{ success: boolean, role?: Role, error?: string }> {
  try {
    const isSuperAdmin = await getIsSuperAdmin();
    if (!isSuperAdmin) {
        return { success: false, error: "Only Super Admins can create roles." };
    }

    const existingRole = await databaseService.getRoleByName(data.name);
    if (existingRole) {
        return { success: false, error: `Role with name "${data.name}" already exists.`};
    }
    const newRole = await databaseService.createRole(data);
    revalidatePath('/admin/settings/role-management');
    revalidatePath('/admin/settings/user-management'); // Roles list might be used there
    return { success: true, role: newRole };
  } catch (error: any) {
    console.error("Error creating role:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { success: false, error: `Role with name "${data.name}" already exists.` };
    }
    return { success: false, error: error.message || "Failed to create role." };
  }
}

export async function updateRoleAction(id: string, data: RoleUpsertData): Promise<{ success: boolean, role?: Role, error?: string }> {
  try {
    const isSuperAdmin = await getIsSuperAdmin();
    if (!isSuperAdmin) {
        return { success: false, error: "Only Super Admins can update roles." };
    }

    // Check if new name conflicts with another existing role
    if (data.name) {
        const roleWithNewName = await databaseService.getRoleByName(data.name);
        if (roleWithNewName && roleWithNewName.id !== id) {
            return { success: false, error: `Another role with name "${data.name}" already exists.`};
        }
    }
    const updatedRole = await databaseService.updateRole(id, data);
    revalidatePath('/admin/settings/role-management');
    revalidatePath('/admin/settings/user-management');
    return { success: true, role: updatedRole };
  } catch (error: any) {
    console.error("Error updating role:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
             return { success: false, error: `Role name conflict. A role with name "${data.name}" might already exist.` };
        }
        if (error.code === 'P2025') {
            return { success: false, error: "Role not found for update." };
        }
    }
    return { success: false, error: error.message || "Failed to update role." };
  }
}

export async function deleteRoleAction(id: string): Promise<{ success: boolean, error?: string }> {
  try {
    const isSuperAdmin = await getIsSuperAdmin();
    if (!isSuperAdmin) {
        return { success: false, error: "Only Super Admins can delete roles." };
    }

    // Check if role is in use before deleting
    const usersWithRole = await prisma.user.count({ where: { roles: { some: { id } } } });
    if (usersWithRole > 0) {
      return { success: false, error: "Cannot delete role as it is currently assigned to one or more users. Please reassign users first." };
    }
    await databaseService.deleteRole(id);
    revalidatePath('/admin/settings/role-management');
    revalidatePath('/admin/settings/user-management');
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting role:", error);
     if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return { success: false, error: "Role not found for deletion." };
    }
    return { success: false, error: error.message || "Failed to delete role." };
  }
}
