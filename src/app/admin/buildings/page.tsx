
import { databaseService } from '@/lib/services/databaseService';
import type { Building as BuildingTypePrisma, PenaltyTier as PenaltyTierTypePrisma } from '@prisma/client';
import { BuildingsClientPage } from './components'; // Import the new client component

// Prisma's Building type might not include relations by default, so we create an interface
// This interface can also be moved to components.tsx or a types file if preferred
export interface BuildingWithPenaltyTiers extends BuildingTypePrisma {
  penaltyPolicyTiers: PenaltyTierTypePrisma[];
}

// This is now a Server Component fetching its own data.
export default async function BuildingsPage() {
  const buildingsData = await databaseService.getAllBuildings({ 
    include: { penaltyPolicyTiers: true },
    orderBy: { createdAt: 'desc' }
  });

  // Ensure Date objects are serializable if not already handled by Prisma or if passing through layers
  // For this direct usage, Prisma Date objects should be fine, but if issues arise, convert to string:
  const serializableBuildings = buildingsData.map(building => ({
    ...building,
    createdAt: building.createdAt.toISOString(),
    // Ensure any other Date fields in penaltyPolicyTiers are also serialized if necessary
    penaltyPolicyTiers: building.penaltyPolicyTiers.map(tier => ({
        ...tier,
        // Assuming PenaltyTier doesn't have Date objects that need serialization. If it does, handle them.
    })),
  }));


  return <BuildingsClientPage initialBuildings={serializableBuildings} />;
}
