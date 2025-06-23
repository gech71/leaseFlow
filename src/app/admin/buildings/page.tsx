
export const dynamic = 'force-dynamic';

import { databaseService } from '@/lib/services/databaseService';
import type { Building as BuildingTypePrisma, PenaltyTier as PenaltyTierTypePrisma, User, Role, Prisma } from '@prisma/client';
import { BuildingsClientPage } from './components'; // Import the new client component
import { cookies } from 'next/headers';

export interface BuildingWithPenaltyTiers extends BuildingTypePrisma {
  penaltyPolicyTiers: PenaltyTierTypePrisma[];
}

// Insecure JWT payload decoder
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
    const ACCESS_TOKEN_KEY = 'leaseflow_access_token';
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_TOKEN_KEY)?.value;
    if (!accessToken) return null;
    
    const tokenPayload = decodeJwtPayload(accessToken);
    if (!tokenPayload || !tokenPayload.sub) return null;

    return await databaseService.getUserByExternalId(tokenPayload.sub, { roles: true });
}


// This is now a Server Component fetching its own data.
export default async function BuildingsPage() {
  const currentUser = await getCurrentUser();
  const isSuperAdmin = currentUser?.roles.some(role => role.name === 'SUPER_ADMIN') ?? false;
  let managedBuildingIds: string[] | undefined = undefined;

  if (!isSuperAdmin && currentUser) {
      const managedBuildings = await databaseService.getAllBuildings({ where: { managedByUserId: currentUser.userId } });
      managedBuildingIds = managedBuildings.map(b => b.id);
  }

  const whereClause: Prisma.BuildingWhereInput = managedBuildingIds ? { id: { in: managedBuildingIds } } : {};
  
  const buildingsData = await databaseService.getAllBuildings({ 
    where: whereClause,
    include: { penaltyPolicyTiers: true },
    orderBy: { createdAt: 'desc' }
  });

  const serializableBuildings = buildingsData.map(building => ({
    ...building,
    createdAt: building.createdAt.toISOString(),
    penaltyPolicyTiers: building.penaltyPolicyTiers.map(tier => ({
        ...tier,
    })),
  }));


  return <BuildingsClientPage initialBuildings={serializableBuildings} />;
}
