
'use server';

import { auth } from '@/lib/auth';
import { databaseService } from '@/lib/services/databaseService';

async function getCurrentUserFromSession() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Authentication required. Session not found.");
  }
  
  const user = await databaseService.getUserById(session.user.id, {
    roles: true,
    managedBuildings: { select: { id: true } },
  });

  if (!user) {
    throw new Error("User from session not found in database.");
  }

  return user;
}

export async function getUserAndPermissions() {
    const currentUser = await getCurrentUserFromSession();

    const isSuperAdmin = currentUser.roles.some(r => r.name === 'SUPER_ADMIN');
    
    const permissions = new Set<string>();
    currentUser.roles.forEach(role => {
        role.permissions.forEach(p => permissions.add(p));
    });
    
    return { currentUser, isSuperAdmin, permissions };
}

export async function getUserAndManagedIds() {
    const currentUser = await getCurrentUserFromSession();

    const isSuperAdmin = currentUser.roles.some(role => role.name === 'SUPER_ADMIN');
    
    const managedBuildingIds = isSuperAdmin ? null : currentUser.managedBuildings.map(b => b.id);
    
    return { currentUser, isSuperAdmin, managedBuildingIds };
}
