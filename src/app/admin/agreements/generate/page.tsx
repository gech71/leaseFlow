
// Main form interaction is client-side, but data fetching for props is server-side.

import { Suspense } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { FileText, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { databaseService } from '@/lib/services/databaseService';
import type { Tenant, Space, Prisma, User, Role } from '@prisma/client'; // For server-side fetching
import { GenerateAgreementClientPage } from './client-page'; // Import the new client component
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
    const cookieStore = cookies();
    const accessToken = cookieStore.get(ACCESS_TOKEN_KEY)?.value;
    if (!accessToken) return null;
    
    const tokenPayload = decodeJwtPayload(accessToken);
    if (!tokenPayload || !tokenPayload.sub) return null;

    return await databaseService.getUserByExternalId(tokenPayload.sub, { roles: true });
}

// Server Component to fetch initial data
export default function GenerateAgreementPage() {
  return (
    <div className="animate-fadeIn">
       <PageHeader
        title="Generate Rental Agreement"
        icon={FileText}
        description="Select tenant and space, generate agreement text with AI, then save the complete record."
        actions={
            <Link href="/admin/agreements" passHref>
                <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Agreements
                </Button>
            </Link>
        }
      />
      <Suspense fallback={<div className="flex justify-center items-center h-[50vh]"><Loader2 className="h-12 w-12 animate-spin text-primary"/></div>}>
        <GenerateAgreementDataFetcher />
      </Suspense>
    </div>
  );
}

// This is an async Server Component responsible for fetching data
async function GenerateAgreementDataFetcher() {
  const currentUser = await getCurrentUser();
  const isSuperAdmin = currentUser?.roles.some(role => role.name === 'SUPER_ADMIN') ?? false;
  let managedBuildingIds: string[] | undefined = undefined;

  if (!isSuperAdmin && currentUser) {
      const managedBuildings = await databaseService.getAllBuildings({ where: { managedByUserId: currentUser.userId } });
      managedBuildingIds = managedBuildings.map(b => b.id);
  }

  const tenantWhereClause: Prisma.TenantWhereInput = managedBuildingIds
    ? {
        OR: [
          { rentedSpaceId: null }, // Unassigned tenants
          { rentedSpace: { buildingId: { in: managedBuildingIds } } } // Tenants in managed buildings
        ]
      }
    : {};

  const spaceWhereClause: Prisma.SpaceWhereInput = {
    isOccupied: false,
    ...(managedBuildingIds ? { buildingId: { in: managedBuildingIds } } : {})
  };


  const tenants = await databaseService.getAllTenants({ where: tenantWhereClause, orderBy: { name: 'asc' }});
  const availableSpaces = await databaseService.getAllSpaces({ where: spaceWhereClause, orderBy: [{buildingName: 'asc'},{spaceIdName: 'asc'}] });

  // Serialize dates before passing to client component
  const serializableTenants = tenants.map(t => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt?.toISOString() || t.createdAt.toISOString() // Fallback for updatedAt
  }));
  const serializableSpaces = availableSpaces.map(s => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt?.toISOString() || s.createdAt.toISOString() // Fallback for updatedAt
  }));
  
  return <GenerateAgreementClientPage tenants={serializableTenants} availableSpaces={serializableSpaces} />;
}
