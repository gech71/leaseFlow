
import { databaseService } from '@/lib/services/databaseService';
import type { Space as SpaceTypePrisma, Building as BuildingTypePrisma } from '@prisma/client';
import { SpacesClientPage, type SpaceWithBuildingName } from './components';

// This is the main Server Component for the page
export default async function SpacesPage() {
  // Fetch initial data on the server
  const spacesData = await databaseService.getAllSpaces({ 
    include: { building: true }, // To get buildingName
    orderBy: { createdAt: 'desc' }
  });
  const buildingsData = await databaseService.getAllBuildings({ orderBy: { name: 'asc' } });

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
    // Ensure penaltyPolicyTiers are handled if BuildingTypePrisma expects them from your Prisma schema
    // If they are not fetched or not part of the base type, this might need adjustment or ensure they are optional
    penaltyPolicyTiers: (building as any).penaltyPolicyTiers || [], // Or fetch them if needed by client
  }));

  return <SpacesClientPage initialSpaces={serializableSpaces} initialBuildings={serializableBuildings} />;
}
