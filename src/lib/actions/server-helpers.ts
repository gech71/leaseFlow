
'use server';

import { auth } from '@/auth';
import { databaseService } from '@/lib/services/databaseService';
import type { User, Role } from '@prisma/client';
import { redirect } from 'next/navigation';

/**
 * A server-side helper to get the fully authenticated user object, their permissions,
 * and super admin status. Throws an error if the user is not authenticated.
 * @returns {Promise<{currentUser: User & { roles: Role[] }, isSuperAdmin: boolean, permissions: Set<string>}>}
 */
export async function getUserAndPermissions() {
    const session = await auth();
    if (!session?.user?.id) {
        // In a real app, you might redirect or throw an error.
        // For server actions, throwing an error is often appropriate.
        redirect('/login');
    }

    const currentUser = await databaseService.getUserById(session.user.id, {
        roles: true,
    });
    
    if (!currentUser) {
        console.error(`CRITICAL: Authenticated user with id ${session.user.id} not found in the database.`);
        redirect('/login');
    }

    const isSuperAdmin = currentUser.roles.some(role => role.name === 'SUPER_ADMIN');
    
    const permissions = new Set<string>();
    if (!isSuperAdmin) {
        currentUser.roles.forEach(role => {
            role.permissions.forEach(permission => permissions.add(permission));
        });
    }
    
    return { currentUser, isSuperAdmin, permissions };
}

/**
 * A server-side helper to get the current user and a list of building IDs they manage.
 * For super admins, managedBuildingIds will be `null` to signify unrestricted access.
 * Throws an error if the user is not authenticated.
 * @returns {Promise<{currentUser: User, isSuperAdmin: boolean, managedBuildingIds: string[] | null}>}
 */
export async function getUserAndManagedIds() {
    const session = await auth();
    if (!session?.user?.id) {
        redirect('/login');
    }

    const currentUser = await databaseService.getUserById(session.user.id, {
        roles: true,
        managedBuildings: { select: { id: true } }
    });

    if (!currentUser) {
        console.error(`CRITICAL: Authenticated user with id ${session.user.id} not found in the database.`);
        redirect('/login');
    }

    const isSuperAdmin = currentUser.roles.some(role => role.name === 'SUPER_ADMIN');
    
    const managedBuildingIds = isSuperAdmin 
        ? null 
        : currentUser.managedBuildings.map(building => building.id);
    
    return { currentUser, isSuperAdmin, managedBuildingIds };
}
