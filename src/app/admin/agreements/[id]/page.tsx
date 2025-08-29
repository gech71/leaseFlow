
export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { FileText, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { databaseService } from '@/lib/services/databaseService';
import type { Agreement as AgreementPrisma, Tenant, Space, User, Role } from '@prisma/client';
import { ViewAgreementClientPage, type AgreementWithRelations } from './client-page'; // Adjusted import
import { cookies } from 'next/headers';
import { getUserAndManagedIds } from '@/lib/actions/server-helpers';

// Server Component to fetch initial data
export default async function ViewAgreementPage({ params }: { params: { id: string } }) {
  const { id } = params; // Destructure ID from params first
  let agreementData = await databaseService.getAgreementById(id, {
    tenant: true, 
    space: true 
  });

  if (agreementData) {
    const { isSuperAdmin, managedBuildingIds } = await getUserAndManagedIds();

    if (!isSuperAdmin) {
        if (!agreementData.space || !managedBuildingIds?.includes(agreementData.space.buildingId)) {
            agreementData = null; // User doesn't manage this building, so they can't see the agreement.
        }
    }
  }


  let serializableAgreement: AgreementWithRelations | null = null;
  if (agreementData) {
    const fallbackDate = new Date(0).toISOString(); // Use epoch as a fallback for any null dates
    serializableAgreement = {
      ...agreementData,
      monthlyRentalPrice: Number(agreementData.monthlyRentalPrice),
      initialPaymentAmount: agreementData.initialPaymentAmount ? Number(agreementData.initialPaymentAmount) : null,
      startDate: agreementData.startDate?.toISOString() || fallbackDate,
      nextPaymentDueDate: agreementData.nextPaymentDueDate?.toISOString() || fallbackDate,
      createdAt: agreementData.createdAt?.toISOString() || fallbackDate,
      updatedAt: agreementData.updatedAt?.toISOString() || agreementData.createdAt?.toISOString() || fallbackDate,
      initialPaymentDate: agreementData.initialPaymentDate?.toISOString() || undefined,
      tenant: agreementData.tenant ? { 
        ...agreementData.tenant, 
        createdAt: agreementData.tenant.createdAt?.toISOString() || fallbackDate, 
        updatedAt: agreementData.tenant.updatedAt?.toISOString() || agreementData.tenant.createdAt?.toISOString() || fallbackDate
      } : null,
      space: agreementData.space ? { 
        ...agreementData.space,
        area: Number(agreementData.space.area),
        utilityProrationShare: Number(agreementData.space.utilityProrationShare),
        monthlyRentalPrice: Number(agreementData.space.monthlyRentalPrice),
        createdAt: agreementData.space.createdAt?.toISOString() || fallbackDate, 
        updatedAt: agreementData.space.updatedAt?.toISOString() || agreementData.space.createdAt?.toISOString() || fallbackDate
      } : null,
    } as AgreementWithRelations;
  }
  
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary"/></div>}>
      <ViewAgreementClientPage agreement={serializableAgreement} />
    </Suspense>
  );
}
