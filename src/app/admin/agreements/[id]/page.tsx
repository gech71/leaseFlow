
import { Suspense } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { FileText, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { databaseService } from '@/lib/services/databaseService';
import type { Agreement as AgreementPrisma, Tenant, Space } from '@prisma/client';
import { ViewAgreementClientPage, type AgreementWithRelations } from './client-page'; // Adjusted import

interface PageParams {
  params: { id: string };
}

// Server Component to fetch initial data
export default async function ViewAgreementPage({ params }: PageParams) {
  // Data fetching logic moved here
  const agreementData = await databaseService.getAgreementById(params.id, { // Corrected: Pass include options directly
    tenant: true, 
    space: true 
  });

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

