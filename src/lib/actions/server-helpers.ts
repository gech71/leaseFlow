
'use server';

import { cookies } from 'next/headers';
import { databaseService } from '@/lib/services/databaseService';
import type { User, Role } from '@prisma/client';

const ADMIN_ACCESS_TOKEN_KEY = 'leaseflow_admin_access_token';

// Insecure JWT payload decoder for prototype purposes ONLY.
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
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ADMIN_ACCESS_TOKEN_KEY)?.value;
    if (!accessToken) return null;
    
    const tokenPayload = decodeJwtPayload(accessToken);
    if (!tokenPayload || !tokenPayload.sub) return null;

    return await databaseService.getUserByExternalId(tokenPayload.sub, { roles: true });
}

// Helper to get user and check permissions
export async function getUserAndPermissions() {
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error("Authentication required.");

    const isSuperAdmin = currentUser.roles.some(r => r.name === 'SUPER_ADMIN');
    const permissions = new Set(currentUser.roles.flatMap(r => r.permissions));
    
    return { currentUser, isSuperAdmin, permissions };
}

// Helper to get user and their managed building IDs
export async function getUserAndManagedIds() {
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
