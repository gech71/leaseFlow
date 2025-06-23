
import { Suspense } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { FileText, Loader2 } from 'lucide-react';
import { databaseService } from '@/lib/services/databaseService';
import type { Agreement as AgreementPrisma, Tenant, Space, User, Role, Prisma } from '@prisma/client';
import { AgreementsListClientPage, type AgreementWithRelations } from './components'; // Import from new components file
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

// This is now a Server Component
export default async function AgreementsListPage() {
  const currentUser = await getCurrentUser();
  const isSuperAdmin = currentUser?.roles.some(role => role.name === 'SUPER_ADMIN') ?? false;
  let managedBuildingIds: string[] | undefined = undefined;

  if (!isSuperAdmin && currentUser) {
      const managedBuildings = await databaseService.getAllBuildings({ where: { managedByUserId: currentUser.userId } });
      managedBuildingIds = managedBuildings.map(b => b.id);
  }

  const whereClause: Prisma.AgreementWhereInput = managedBuildingIds
    ? { space: { buildingId: { in: managedBuildingIds } } }
    : {};

  const agreementsData = await databaseService.getAllAgreements({
    where: whereClause,
    include: { tenant: true, space: true, bills: { select: { id: true } } },
    orderBy: { createdAt: 'desc' }
  });

  const serializableAgreements = agreementsData.map(ag => ({
    ...ag,
    startDate: ag.startDate.toISOString(),
    nextPaymentDueDate: ag.nextPaymentDueDate.toISOString(),
    createdAt: ag.createdAt.toISOString(),
    updatedAt: ag.updatedAt?.toISOString() || ag.createdAt.toISOString(), // Safe serialization
    initialPaymentDate: ag.initialPaymentDate?.toISOString() || undefined,
    tenant: ag.tenant ? { 
      ...ag.tenant, 
      createdAt: ag.tenant.createdAt.toISOString(), 
      updatedAt: ag.tenant.updatedAt?.toISOString() || ag.tenant.createdAt.toISOString() // Safe serialization
    } : null,
    space: ag.space ? { 
      ...ag.space, 
      createdAt: ag.space.createdAt.toISOString(), 
      updatedAt: ag.space.updatedAt?.toISOString() || ag.space.createdAt.toISOString() // Safe serialization
    } : null,
  })) as AgreementWithRelations[];

  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"/></div>}>
      <AgreementsListClientPage initialAgreements={serializableAgreements} />
    </Suspense>
  );
}
