
import { Suspense } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Building as BuildingIconLucide, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { databaseService } from '@/lib/services/databaseService';
import { BuildingUpsertFormInternal, type BuildingUpsertFormInternalProps } from './building-form';

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
      penaltyPolicyTiers: true // Corrected: Pass the Prisma.BuildingInclude object directly
    });
    if (buildingToEdit) {
      formMode = 'edit';
      pageTitle = "Edit Building";
      initialBuildingDataSerializable = {
        id: buildingToEdit.id,
        name: buildingToEdit.name,
        address: buildingToEdit.address || '', // Ensure address is string or empty string
        createdAt: buildingToEdit.createdAt.toISOString(), // Serialize date
        penaltyPolicyTiers: buildingToEdit.penaltyPolicyTiers.map(tier => ({
          ...tier,
          // Assuming PenaltyTier doesn't have Date objects that need serialization.
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
