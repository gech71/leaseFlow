'use server';

import { auth } from '@/auth';
import { databaseService } from '@/lib/services/databaseService';
import type { User, Role } from '@prisma/client';

async function getCurrentUser() {
    const session = await auth();
    if (!session?.user?.id) return null;

    return await databaseService.getUserById(session.user.id, { 
      roles: true,
      managedBuildings: { select: { id: true } }
    });
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
    
    const managedBuildingIds = isSuperAdmin ? null : currentUser.managedBuildings.map(b => b.id);
    
    return { currentUser, isSuperAdmin, managedBuildingIds };
}