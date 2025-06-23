
import { Suspense } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { FileText, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { databaseService } from '@/lib/services/databaseService';
import type { Agreement as AgreementPrisma, Tenant, Space, User, Role } from '@prisma/client';
import { ViewAgreementClientPage, type AgreementWithRelations } from './client-page'; // Adjusted import
import { cookies } from 'next/headers';

interface PageParams {
  params: { id: string };
}

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
export default async function ViewAgreementPage({ params }: PageParams) {
  let agreementData = await databaseService.getAgreementById(params.id, {
    tenant: true, 
    space: true 
  });

  if (agreementData) {
    const currentUser = await getCurrentUser();
    const isSuperAdmin = currentUser?.roles.some(role => role.name === 'SUPER_ADMIN') ?? false;

    if (!isSuperAdmin && currentUser) {
        const managedBuildings = await databaseService.getAllBuildings({ where: { managedByUserId: currentUser.userId } });
        const managedBuildingIds = managedBuildings.map(b => b.id);
        if (!agreementData.space || !managedBuildingIds.includes(agreementData.space.buildingId)) {
            agreementData = null; // User doesn't manage this building, so they can't see the agreement.
        }
    }
  }


  let serializableAgreement: AgreementWithRelations | null = null;
  if (agreementData) {
    serializableAgreement = {
      ...agreementData,
      startDate: agreementData.startDate.toISOString(),
      nextPaymentDueDate: agreementData.nextPaymentDueDate.toISOString(),
      createdAt: agreementData.createdAt.toISOString(),
      updatedAt: agreementData.updatedAt?.toISOString() || agreementData.createdAt.toISOString(), // Safe serialization
      initialPaymentDate: agreementData.initialPaymentDate?.toISOString() || undefined,
      tenant: agreementData.tenant ? { 
        ...agreementData.tenant, 
        createdAt: agreementData.tenant.createdAt.toISOString(), 
        updatedAt: agreementData.tenant.updatedAt?.toISOString() || agreementData.tenant.createdAt.toISOString() // Safe serialization
      } : null,
      space: agreementData.space ? { 
        ...agreementData.space, 
        createdAt: agreementData.space.createdAt.toISOString(), 
        updatedAt: agreementData.space.updatedAt?.toISOString() || agreementData.space.createdAt.toISOString() // Safe serialization
      } : null,
    } as AgreementWithRelations;
  }
  
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary"/></div>}>
      <ViewAgreementClientPage agreement={serializableAgreement} />
    </Suspense>
  );
}
