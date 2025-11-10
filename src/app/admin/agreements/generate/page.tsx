
export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { FileText, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { databaseService } from '@/lib/services/databaseService';
import type { Tenant, Space, Prisma, User, Role, AgreementTemplate } from '@prisma/client';
import { GenerateAgreementClientPage } from './client-page';
import { getUserAndManagedIds } from '@/lib/actions/server-helpers';

export default function GenerateAgreementPage() {
  return (
    <div className="animate-fadeIn">
       <PageHeader
        title="Generate Rental Agreement"
        description="Select a template, tenant, and space, then generate and save the complete record."
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

async function GenerateAgreementDataFetcher() {
  const { isSuperAdmin, managedBuildingIds, currentUser } = await getUserAndManagedIds();

  const tenantWhereClause: Prisma.TenantWhereInput = {};

  const spaceWhereClause: Prisma.SpaceWhereInput = {
    isOccupied: false,
    ...(!isSuperAdmin ? { buildingId: { in: managedBuildingIds! } } : {})
  };

  const agreementTemplateWhere: Prisma.AgreementTemplateWhereInput = !isSuperAdmin
    ? { createdById: currentUser.id }
    : {};


  const tenants = await databaseService.getAllTenants({ where: tenantWhereClause, orderBy: { name: 'asc' }});
  const availableSpaces = await databaseService.getAllSpaces({ where: spaceWhereClause, orderBy: [{buildingName: 'asc'},{spaceIdName: 'asc'}] });
  const agreementTemplates = await databaseService.getAllAgreementTemplates({ where: agreementTemplateWhere, orderBy: { name: 'asc' } });

  const serializableTenants = tenants.map(t => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt?.toISOString() || t.createdAt.toISOString()
  }));
  const serializableSpaces = availableSpaces.map(s => ({
    ...s,
    area: Number(s.area),
    utilityProrationShare: Number(s.utilityProrationShare),
    monthlyRentalPrice: Number(s.monthlyRentalPrice),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt?.toISOString() || s.createdAt.toISOString()
  }));
  
  return <GenerateAgreementClientPage tenants={serializableTenants} availableSpaces={serializableSpaces} agreementTemplates={agreementTemplates} />;
}
