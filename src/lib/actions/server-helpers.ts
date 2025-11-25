
'use server';
import 'server-only';

import { verifySession, ACCESS_TOKEN_COOKIE_NAME } from '@/lib/auth/jwt';
import { databaseService } from '@/lib/services/databaseService';
import type { User, Role } from '@prisma/client';
import { redirect } from 'next/navigation';
import type { CurrentUser } from '@/lib/types';
import { cookies } from 'next/headers';

/**
 * A server-side helper to get the fully authenticated user object, their permissions,
 * and super admin status. Throws an error if the user is not authenticated.
 * @returns {Promise<{currentUser: User & { roles: Role[] }, isSuperAdmin: boolean, permissions: Set<string>}>}
 */
export async function getUserAndPermissions() {
    const token = cookies().get(ACCESS_TOKEN_COOKIE_NAME)?.value;
    const session = await verifySession(token);
    if (!session?.userId) {
        // Instead of redirecting, which causes issues with server actions, we throw a specific error.
        throw new Error("Authentication required. Please log in again.");
    }

    const currentUser = await databaseService.getUserById(session.userId, {
        roles: true,
    });
    
    if (!currentUser) {
        console.error(`CRITICAL: Authenticated user with id ${session.userId} not found in the database.`);
        throw new Error("Authentication failed: User not found.");
    }

    const isSuperAdmin = session.isSuperAdmin;
    const permissions = new Set<string>(session.permissions);
    
    return { currentUser, isSuperAdmin, permissions };
}

/**
 * A server-side helper to get the current user and a list of building IDs they manage.
 * For super admins, managedBuildingIds will be `null` to signify unrestricted access.
 * Throws an error if the user is not authenticated.
 * @returns {Promise<{currentUser: User, isSuperAdmin: boolean, managedBuildingIds: string[] | null}>}
 */
export async function getUserAndManagedIds() {
    const token = cookies().get(ACCESS_TOKEN_COOKIE_NAME)?.value;
    const session = await verifySession(token);
     if (!session?.userId) {
        throw new Error("Authentication required. Please log in again.");
    }

    const currentUser = await databaseService.getUserById(session.userId, {
        roles: true,
        managedBuildings: { select: { id: true } }
    });

    if (!currentUser) {
        console.error(`CRITICAL: Authenticated user with id ${session.userId} not found in the database.`);
        throw new Error("Authentication failed: User not found.");
    }

    const isSuperAdmin = session.isSuperAdmin;
    
    const managedBuildingIds = isSuperAdmin 
        ? null 
        : currentUser.managedBuildings.map(building => building.id);

    const permissions = new Set<string>(session.permissions);
    
    return { currentUser, isSuperAdmin, managedBuildingIds, permissions };
}

/**
 * Redirects to a specified URL and appends an error message for the client to display as a toast.
 * @param {string} url - The URL to redirect to.
 * @param {string} message - The error message to display.
 */
export async function redirectWithToast(url: string, message: string) {
  const finalUrl = `${url}?error=${encodeURIComponent(message)}`;
  return redirect(finalUrl);
}

// This new server action replaces the /api/user/me endpoint
export async function getUserSessionAction(): Promise<{
  isSuccess: boolean;
  user: CurrentUser | null;
}> {
  try {
    const token = cookies().get(ACCESS_TOKEN_COOKIE_NAME)?.value;
    const session = await verifySession(token);

    if (!session?.userId) {
      return { isSuccess: false, user: null };
    }

    const localUser = await databaseService.getUserById(session.userId, {
      roles: true,
    });

    if (!localUser) {
      return { isSuccess: false, user: null };
    }

    const effectivePermissions = session.permissions ?? [];

    const currentUserData: CurrentUser = {
      id: localUser.id,
      email: localUser.email,
      name: localUser.name || `${localUser.firstName} ${localUser.lastName}`.trim(),
      firstName: localUser.firstName,
      lastName: localUser.lastName,
      phoneNumber: localUser.phoneNumber,
      roles: localUser.roles.map((role) => ({
        id: role.id,
        name: role.name,
        permissions: role.permissions || [],
      })),
      effectivePermissions,
    };

    return { isSuccess: true, user: currentUserData };
  } catch (error) {
    console.error("Error in getUserSessionAction:", error);
    return { isSuccess: false, user: null };
  }
}
