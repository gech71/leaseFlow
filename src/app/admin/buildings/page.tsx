
export const dynamic = 'force-dynamic';

import { databaseService } from '@/lib/services/databaseService';
import type { Building as BuildingTypePrisma, PenaltyTier as PenaltyTierTypePrisma, User, Role, Prisma } from '@prisma/client';
import { BuildingsClientPage } from './components'; // Import the new client component
import { getUserAndManagedIds, redirectWithToast } from '@/lib/actions/server-helpers';
import { hasPermission } from '@/lib/auth-utils';

export interface BuildingWithPenaltyTiers extends BuildingTypePrisma {
  penaltyPolicyTiers: PenaltyTierTypePrisma[];
}

// This is now a Server Component fetching its own data.
export default async function BuildingsPage() {
  const { isSuperAdmin, managedBuildingIds, permissions } = await getUserAndManagedIds();

  if (!isSuperAdmin && !hasPermission(permissions, 'building:view')) {
    return redirectWithToast('/admin/dashboard', 'You do not have permission to view buildings.');
  }

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
        feeValue: Number(tier.feeValue),
    })),
  }));


  return <BuildingsClientPage initialBuildings={serializableBuildings} />;
}
