
import { databaseService } from '@/lib/services/databaseService';
import type { Space as SpaceTypePrisma, Building as BuildingTypePrisma, Prisma, User, Role } from '@prisma/client';
import { SpacesClientPage, type SpaceWithBuildingName } from './components';
import { cookies } from 'next/headers';

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

// This is the main Server Component for the page
export default async function SpacesPage() {
  const currentUser = await getCurrentUser();
  const isSuperAdmin = currentUser?.roles.some(role => role.name === 'SUPER_ADMIN') ?? false;
  let managedBuildingIds: string[] | undefined = undefined;

  if (!isSuperAdmin && currentUser) {
      const managedBuildings = await databaseService.getAllBuildings({ where: { managedByUserId: currentUser.userId } });
      managedBuildingIds = managedBuildings.map(b => b.id);
  }
  
  const spaceWhere: Prisma.SpaceWhereInput = managedBuildingIds ? { buildingId: { in: managedBuildingIds } } : {};
  const buildingWhere: Prisma.BuildingWhereInput = managedBuildingIds ? { id: { in: managedBuildingIds } } : {};

  const spacesData = await databaseService.getAllSpaces({ 
    where: spaceWhere,
    include: { building: true },
    orderBy: { createdAt: 'desc' }
  });
  const buildingsData = await databaseService.getAllBuildings({ where: buildingWhere, orderBy: { name: 'asc' } });

  // Serialize dates and structure data for the client component
  const serializableSpaces: SpaceWithBuildingName[] = spacesData.map(space => ({
    ...space,
    createdAt: space.createdAt.toISOString(),
    updatedAt: space.updatedAt?.toISOString() || new Date().toISOString(), 
    buildingName: space.building.name,
  }));

  const serializableBuildings: BuildingTypePrisma[] = buildingsData.map(building => ({
    ...building,
    createdAt: building.createdAt.toISOString(),
    updatedAt: building.updatedAt?.toISOString() || new Date().toISOString(),
    penaltyPolicyTiers: (building as any).penaltyPolicyTiers || [],
  }));

  return <SpacesClientPage initialSpaces={serializableSpaces} initialBuildings={serializableBuildings} />;
}
