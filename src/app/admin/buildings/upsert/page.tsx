
import { Suspense } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Building as BuildingIconLucide, ArrowLeft, Loader2 } from 'lucide-react';
import type { Building as BuildingTypePrisma, PenaltyTier as PenaltyTierTypePrisma } from '@prisma/client';
import Link from 'next/link';
import { databaseService } from '@/lib/services/databaseService';
import { BuildingUpsertFormInternal, type BuildingUpsertFormInternalProps } from './building-form'; // Import from new file

// This is the main Server Component for the page
// It will handle fetching data based on searchParams and pass it to the client component
export default function BuildingUpsertPage({ searchParams }: { searchParams: { id?: string } }) {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary"/></div>}>
      <BuildingUpsertDataFetcher buildingIdParam={searchParams.id} />
    </Suspense>
  );
}

async function BuildingUpsertDataFetcher({ buildingIdParam }: { buildingIdParam?: string}) {
  let initialBuildingDataSerializable: BuildingUpsertFormInternalProps['initialBuildingData'] = null;
  let formMode: 'add' | 'edit' = 'add';
  let pageTitle = "Add New Building";

  if (buildingIdParam) {
    const buildingToEdit = await databaseService.getBuildingById(buildingIdParam, {
      include: { penaltyPolicyTiers: true }
    });
    if (buildingToEdit) {
      formMode = 'edit';
      pageTitle = "Edit Building";
      initialBuildingDataSerializable = {
        id: buildingToEdit.id,
        name: buildingToEdit.name,
        address: buildingToEdit.address || '', // Ensure address is string or empty string
        createdAt: buildingToEdit.createdAt.toISOString(), // Serialize date
        // Ensure penaltyPolicyTiers are correctly serialized if they contain dates or complex objects not directly usable by client.
        // For now, assuming PenaltyTierTypePrisma is simple enough or its dates are handled by the client form.
        penaltyPolicyTiers: buildingToEdit.penaltyPolicyTiers.map(tier => ({
          ...tier,
          // No dates in PenaltyTier, so direct mapping is fine
        })),
      };
    }
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title={pageTitle}
        icon={BuildingIconLucide}
        description="Define building details and late fee policies."
        actions={
            <Link href="/admin/buildings" passHref>
                <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Buildings
                </Button>
            </Link>
        }
      />
      <BuildingUpsertFormInternal 
        initialBuildingData={initialBuildingDataSerializable} 
        formMode={formMode} 
      />
    </div>
  );
}
