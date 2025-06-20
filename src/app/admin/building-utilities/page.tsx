
// Main page.tsx is now a Server Component by default (no "use client" at the top)

import { Suspense } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Wrench, Loader2 } from 'lucide-react';
import { databaseService } from '@/lib/services/databaseService';
import type { Building as BuildingPrismaType, BuildingMonthlyUtilities as BuildingMonthlyUtilitiesPrismaType } from '@prisma/client';
import { BuildingUtilitiesClientPage } from './client-page'; // Import the new client component
import { getAllBuildingUtilitiesForListAction, getRegisteredBuildingsAction } from './actions';
import { parseISO } from 'date-fns';


// Server Component to fetch initial data
export default function BuildingUtilitiesServerPage() {
  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Manage Building Utilities"
        icon={Wrench}
        description="Enter monthly utility costs for each building. Define costs by scope: entire building, specific floors, or specific spaces."
      />
      <Suspense fallback={<div className="flex justify-center items-center h-[50vh]"><Loader2 className="h-12 w-12 animate-spin text-primary"/></div>}>
        <BuildingUtilitiesDataFetcher />
      </Suspense>
    </div>
  );
}

// This is an async Server Component responsible for fetching data
async function BuildingUtilitiesDataFetcher() {
  const buildings = await getRegisteredBuildingsAction();
  const initialRecordsRaw = await getAllBuildingUtilitiesForListAction();
  
  // Serialize dates for client component props
  const serializableBuildings = buildings.map(b => ({
    ...b,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt?.toISOString() || b.createdAt.toISOString(), // Safe serialization
  }));

  const serializableInitialRecords = initialRecordsRaw.map(r => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt?.toISOString() || r.createdAt.toISOString(), // Safe serialization
    utilities: r.utilities.map(u => ({...u})) // Assuming utility items don't have dates needing serialization
  }));

  return <BuildingUtilitiesClientPage initialBuildings={serializableBuildings} initialUtilityRecords={serializableInitialRecords} />;
}
