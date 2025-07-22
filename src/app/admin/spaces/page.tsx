
export const dynamic = 'force-dynamic';

import { databaseService } from '@/lib/services/databaseService';
import type { Space as SpaceTypePrisma, Building as BuildingTypePrisma, Prisma, User, Role } from '@prisma/client';
import { SpacesClientPage, type SpaceWithBuildingName } from './components';
import { getUserAndManagedIds } from '@/lib/actions/server-helpers';
import { addMonths, isAfter } from 'date-fns'; // Import date-fns functions

// This is the main Server Component for the page
export default async function SpacesPage() {
  const { isSuperAdmin, managedBuildingIds } = await getUserAndManagedIds();
  
  const spaceWhere: Prisma.SpaceWhereInput = !isSuperAdmin ? { buildingId: { in: managedBuildingIds! } } : {};
  const buildingWhere: Prisma.BuildingWhereInput = !isSuperAdmin ? { id: { in: managedBuildingIds! } } : {};

  const spacesData = await databaseService.getAllSpaces({ 
    where: spaceWhere,
    include: { 
        building: true,
        agreements: true,
    },
    orderBy: { createdAt: 'desc' }
  });
  const buildingsData = await databaseService.getAllBuildings({ where: buildingWhere, orderBy: { name: 'asc' } });

  // Serialize dates and structure data for the client component
  const serializableSpaces: SpaceWithBuildingName[] = spacesData.map(space => {
    let availabilityDate: string | null = null;
    if (space.isOccupied && space.agreements.length > 0) {
      const activeAgreements = space.agreements
        .filter(ag => isAfter(addMonths(ag.startDate, ag.paymentTermMonths), new Date()))
        .sort((a,b) => b.startDate.getTime() - a.startDate.getTime());

      if (activeAgreements.length > 0) {
        const endDate = addMonths(activeAgreements[0].startDate, activeAgreements[0].paymentTermMonths);
        availabilityDate = endDate.toISOString();
      }
    }
    
    return {
      ...space,
      createdAt: space.createdAt.toISOString(),
      updatedAt: space.updatedAt?.toISOString() || new Date().toISOString(), 
      buildingName: space.building.name,
      availabilityDate,
    };
  });

  const serializableBuildings: BuildingTypePrisma[] = buildingsData.map(building => ({
    ...building,
    createdAt: building.createdAt.toISOString(),
    updatedAt: building.updatedAt?.toISOString() || new Date().toISOString(),
    penaltyPolicyTiers: (building as any).penaltyPolicyTiers || [],
  }));

  return <SpacesClientPage initialSpaces={serializableSpaces} initialBuildings={serializableBuildings} />;
}
