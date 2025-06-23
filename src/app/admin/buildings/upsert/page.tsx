
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
    const ACCESS_TOKEN_KEY = 'leaseflow_access_token';
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_TOKEN_KEY)?.value;
    if (!accessToken) return null;
    
    const tokenPayload = decodeJwtPayload(accessToken);
    if (!tokenPayload || !tokenPayload.sub) return null;

    return await databaseService.getUserByExternalId(tokenPayload.sub, { roles: true });
}

// This is the main Server Component for the page
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
    let buildingToEdit = await databaseService.getBuildingById(buildingIdParam, {
      include: { penaltyPolicyTiers: true }
    });

    // Security Check: Ensure non-super-admin can only edit their own buildings
    if (buildingToEdit) {
        const currentUser = await getCurrentUser();
        const isSuperAdmin = currentUser?.roles.some(role => role.name === 'SUPER_ADMIN') ?? false;

        if (!isSuperAdmin && currentUser) {
            if (buildingToEdit.managedByUserId !== currentUser.userId) {
                buildingToEdit = null; // User doesn't manage this building, treat as not found.
            }
        }
    }

    if (buildingToEdit) {
      formMode = 'edit';
      pageTitle = "Edit Building";
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
