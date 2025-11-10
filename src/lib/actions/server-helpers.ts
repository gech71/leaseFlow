'use server';

import { databaseService } from '@/lib/services/databaseService';
import type { User, Role } from '@prisma/client';

// Mock a super admin user since auth is removed
async function getMockAdminUser() {
    let user = await databaseService.findUserByEmailOrPhone('superadmin@nibrental.com', null);
    if (!user) {
        // A fallback in case the seed user doesn't exist
        return {
            id: 'clx0kcxmp000008l4hyx95k8o', // A dummy ID
            userId: 'mock-super-admin',
            email: 'superadmin@nibrental.com',
            name: 'Super Admin',
            roles: [{ name: 'SUPER_ADMIN', permissions: [] }],
            managedBuildings: [],
        } as any;
    }
    const userWithRelations = await databaseService.getUserById(user.id, {
        roles: true,
        managedBuildings: { select: { id: true } }
    });
    return userWithRelations;
}

// Helper to get user and check permissions
export async function getUserAndPermissions() {
    const currentUser = await getMockAdminUser();
    if (!currentUser) throw new Error("Mock user not found.");

    const isSuperAdmin = true; // Always super admin
    const permissions = new Set<string>(); // Could populate with all if needed
    
    return { currentUser, isSuperAdmin, permissions };
}

// Helper to get user and their managed building IDs
export async function getUserAndManagedIds() {
    const currentUser = await getMockAdminUser();
    if (!currentUser) throw new Error("Mock user not found.");

    const isSuperAdmin = true;
    
    // Super admin can see all buildings, so managedBuildingIds is null
    const managedBuildingIds = null;
    
    return { currentUser, isSuperAdmin, managedBuildingIds };
}
