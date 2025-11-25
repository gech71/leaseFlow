
'use server';
import 'server-only';
import { verifySession } from '@/lib/auth/jwt';
import { databaseService } from '@/lib/services/databaseService';
import { redirect } from 'next/navigation';
import type { CurrentUser } from '@/lib/types';
import Cookies from 'js-cookie';

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
    const session = await verifySession();

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
