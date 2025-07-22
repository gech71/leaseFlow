
export const dynamic = 'force-dynamic';

import { databaseService } from '@/lib/services/databaseService';
import type { Building as BuildingTypePrisma, PenaltyTier as PenaltyTierTypePrisma, User, Role, Prisma } from '@prisma/client';
import { BuildingsClientPage } from './components'; // Import the new client component
import { getUserAndManagedIds } from '@/lib/actions/server-helpers';

export interface BuildingWithPenaltyTiers extends BuildingTypePrisma {
  penaltyPolicyTiers: PenaltyTierTypePrisma[];
}

// This is now a Server Component fetching its own data.
export default async function BuildingsPage() {
  const { isSuperAdmin, managedBuildingIds } = await getUserAndManagedIds();

  const whereClause: Prisma.BuildingWhereInput = !isSuperAdmin ? { id: { in: managedBuildingIds! } } : {};
  
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
