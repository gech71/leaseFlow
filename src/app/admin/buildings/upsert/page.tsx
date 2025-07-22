
export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Building as BuildingIconLucide, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { databaseService } from '@/lib/services/databaseService';
import { BuildingUpsertFormInternal, type BuildingUpsertFormInternalProps } from './building-form';
import type { User, Role } from '@prisma/client';
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
    const ACCESS_TOKEN_KEY = 'leaseflow_admin_access_token';
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_TOKEN_KEY)?.value;
    if (!accessToken) return null;
    
    const tokenPayload = decodeJwtPayload(accessToken);
    if (!tokenPayload || !tokenPayload.sub) return null;

    return await databaseService.getUserByExternalId(tokenPayload.sub, { roles: true });
}

// Data fetching component
async function BuildingDataFetcher({ buildingId }: { buildingId?: string }) {
  let initialBuildingDataSerializable: BuildingUpsertFormInternalProps['initialBuildingData'] = null;
  let formMode: 'add' | 'edit' = 'add';

  if (buildingId) {
    let buildingToEdit = await databaseService.getBuildingById(buildingId, {
      penaltyPolicyTiers: true
    });

    if (buildingToEdit) {
        const currentUser = await getCurrentUser();
        const isSuperAdmin = currentUser?.roles.some(role => role.name === 'SUPER_ADMIN') ?? false;

        if (!isSuperAdmin && currentUser) {
            if (buildingToEdit.managedByUserId !== currentUser.userId) {
                buildingToEdit = null;
            }
        }
    }

    if (buildingToEdit) {
      formMode = 'edit';
      initialBuildingDataSerializable = {
        id: buildingToEdit.id,
        name: buildingToEdit.name,
        address: buildingToEdit.address || '',
        createdAt: buildingToEdit.createdAt.toISOString(),
        penaltyPolicyTiers: buildingToEdit.penaltyPolicyTiers.map(tier => ({
          ...tier,
        })),
      };
    }
  }

  return (
    <BuildingUpsertFormInternal
      initialBuildingData={initialBuildingDataSerializable}
      formMode={formMode}
    />
  );
}


// This is the main Server Component for the page
export default async function BuildingUpsertPage({ searchParams }: { searchParams?: { id?: string } }) {
  const pageTitle = searchParams?.id ? "Edit Building" : "Add New Building";
  
  return (
    <div className="animate-fadeIn">
      <PageHeader
        title={pageTitle}
        description="Define building details and late fee policies."
        actions={
            <Link href="/admin/buildings" passHref>
                <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Buildings
                </Button>
            </Link>
        }
      />
      <Suspense fallback={<div className="flex justify-center items-center h-[50vh]"><Loader2 className="h-12 w-12 animate-spin text-primary"/></div>}>
        <BuildingDataFetcher buildingId={searchParams?.id} />
      </Suspense>
    </div>
  );
}
