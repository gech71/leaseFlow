
'use server';
import 'server-only';
import { verifySession } from '@/lib/auth/jwt';
import { databaseService } from '@/lib/services/databaseService';
import type { User, Role } from '@prisma/client';
import { redirect } from 'next/navigation';

/**
 * A server-side helper to get the fully authenticated user object, their permissions,
 * and super admin status. Throws an error if the user is not authenticated.
 * @returns {Promise<{currentUser: User & { roles: Role[] }, isSuperAdmin: boolean, permissions: Set<string>}>}
 */
export async function getUserAndPermissions() {
    const session = await verifySession();
    if (!session?.userId) {
        redirect('/login');
    }

    const currentUser = await databaseService.getUserById(session.userId, {
        roles: true,
    });
    
    if (!currentUser) {
        console.error(`CRITICAL: Authenticated user with id ${session.userId} not found in the database.`);
        redirect('/login');
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
    const session = await verifySession();
    if (!session?.userId) {
        redirect('/login');
    }

    const currentUser = await databaseService.getUserById(session.userId, {
        roles: true,
        managedBuildings: { select: { id: true } }
    });

    if (!currentUser) {
        console.error(`CRITICAL: Authenticated user with id ${session.userId} not found in the database.`);
        redirect('/login');
    }

    const isSuperAdmin = session.isSuperAdmin;
    
    const managedBuildingIds = isSuperAdmin 
        ? null 
        : currentUser.managedBuildings.map(building => building.id);

    const permissions = new Set<string>(session.permissions);
    
    return { currentUser, isSuperAdmin, managedBuildingIds, permissions };
}
