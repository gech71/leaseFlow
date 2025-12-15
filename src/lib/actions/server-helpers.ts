"use server";
import "server-only";

import { verifySession, ACCESS_TOKEN_COOKIE_NAME } from "@/lib/auth/jwt";
import { GENERIC_AUTH_ERROR } from "@/lib/security/messages";
import { databaseService } from "@/lib/services/databaseService";
import type { User, Role } from "@prisma/client";
import { redirect } from "next/navigation";
import type { CurrentUser } from "@/lib/types";
import { cookies } from "next/headers";

type UserWithRoles = User & { roles: Role[] };
type UserWithRolesAndManagedBuildings = User & {
  roles: Role[];
  managedBuildings: Array<{ id: string }>;
};

/**
 * A server-side helper to get the fully authenticated user object, their permissions,
 * and super admin status. Throws an error if the user is not authenticated.
 * @returns {Promise<{currentUser: User & { roles: Role[] }, isSuperAdmin: boolean, permissions: Set<string>}>}
 */
export async function getUserAndPermissions() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE_NAME)?.value;
  const session = await verifySession(token);
  if (!session?.userId) {
    // Instead of redirecting, which causes issues with server actions, we throw a generic auth error.
    throw new Error(GENERIC_AUTH_ERROR);
  }

  const currentUser = (await databaseService.getUserById(session.userId, {
    roles: true,
  })) as UserWithRoles | null;

  if (!currentUser) {
    console.error(
      `CRITICAL: Authenticated user with id ${session.userId} not found in the database.`,
    );
    throw new Error(GENERIC_AUTH_ERROR);
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
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE_NAME)?.value;
  const session = await verifySession(token);
  if (!session?.userId) {
    throw new Error(GENERIC_AUTH_ERROR);
  }

  const currentUser = (await databaseService.getUserById(session.userId, {
    roles: true,
    managedBuildings: { select: { id: true } },
  })) as UserWithRolesAndManagedBuildings | null;

  if (!currentUser) {
    console.error(
      `CRITICAL: Authenticated user with id ${session.userId} not found in the database.`,
    );
    throw new Error(GENERIC_AUTH_ERROR);
  }

  const isSuperAdmin = session.isSuperAdmin;

  const managedBuildingIds = isSuperAdmin
    ? null
    : currentUser.managedBuildings.map((building) => building.id);

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
    const cookieStore = await cookies();
    const token = cookieStore.get(ACCESS_TOKEN_COOKIE_NAME)?.value;
    const session = await verifySession(token);

    if (!session?.userId) {
      return { isSuccess: false, user: null };
    }

    const localUser = (await databaseService.getUserById(session.userId, {
      roles: true,
    })) as UserWithRoles | null;

    if (!localUser) {
      return { isSuccess: false, user: null };
    }

    const effectivePermissions = session.permissions ?? [];

    const constructedName = [localUser.firstName, localUser.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    const displayName =
      localUser.name || constructedName || localUser.email || "User";

    const currentUserData: CurrentUser = {
      id: localUser.id,
      email: localUser.email,
      name: displayName,
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
