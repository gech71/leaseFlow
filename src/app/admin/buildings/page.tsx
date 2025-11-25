
export const dynamic = 'force-dynamic';

import { databaseService } from '@/lib/services/databaseService';
import type { Building as BuildingTypePrisma, PenaltyTier as PenaltyTierTypePrisma, User, Role, Prisma, BuildingStatus } from '@prisma/client';
import { BuildingsClientPage } from './components'; // Import the new client component
import { getUserAndManagedIds } from '@/lib/actions/server-helpers';

export interface BuildingWithRelations extends BuildingTypePrisma {
  penaltyPolicyTiers: PenaltyTierTypePrisma[];
  createdBy: User | null;
  approvedBy: User | null;
}

// This is now a Server Component fetching its own data.
export default async function BuildingsPage() {
  const { isSuperAdmin, managedBuildingIds } = await getUserAndManagedIds();

  const whereClause: Prisma.BuildingWhereInput = !isSuperAdmin ? { id: { in: managedBuildingIds! } } : {};
  
  const buildingsData = await databaseService.getAllBuildings({ 
    where: whereClause,
    include: { 
      penaltyPolicyTiers: true,
      createdBy: true,
      approvedBy: true,
     },
    orderBy: { createdAt: 'desc' }
  });

  const serializableBuildings = buildingsData.map(building => ({
    ...building,
    createdAt: building.createdAt.toISOString(),
    penaltyPolicyTiers: building.penaltyPolicyTiers.map(tier => ({
        ...tier,
        feeValue: Number(tier.feeValue),
    })),
  }));


  return <BuildingsClientPage initialBuildings={serializableBuildings} />;
}
