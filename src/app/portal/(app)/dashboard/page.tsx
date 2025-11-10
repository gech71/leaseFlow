
export const dynamic = 'force-dynamic';

import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import type { PenaltyTier as PenaltyTierPrisma, Agreement as AgreementPrisma, Bill as BillPrisma, Space as SpacePrisma, Building as BuildingPrisma, Tenant as TenantPrisma } from '@prisma/client';
import { getTenantPortalDashboardDataAction, type PortalAgreementWithRelations } from './actions';
import { CustomerDashboardClientPage } from './client-page'; 
import type { ClientAgreement, ClientBill, SerializedTenantPortalData, ClientPenaltyTier, ClientBuilding, ClientSpace, ClientTenant, ClientUtilityBreakdownItem } from './page';

const EPOCH_ISO_STRING = new Date(0).toISOString();

// Helper function to serialize a single agreement with deep relations
const serializeAgreementData = (agreementWithParsedUtilities: PortalAgreementWithRelations): ClientAgreement => {
  const tenant = agreementWithParsedUtilities.tenant;
  const space = agreementWithParsedUtilities.space;
  const building = space?.building;

  return {
    ...agreementWithParsedUtilities,
    monthlyRentalPrice: Number(agreementWithParsedUtilities.monthlyRentalPrice),
    initialPaymentAmount: agreementWithParsedUtilities.initialPaymentAmount ? Number(agreementWithParsedUtilities.initialPaymentAmount) : null,
    createdAt: agreementWithParsedUtilities.createdAt?.toISOString() || EPOCH_ISO_STRING,
    updatedAt: agreementWithParsedUtilities.updatedAt?.toISOString() || agreementWithParsedUtilities.createdAt?.toISOString() || EPOCH_ISO_STRING,
    startDate: agreementWithParsedUtilities.startDate?.toISOString() || EPOCH_ISO_STRING,
    nextPaymentDueDate: agreementWithParsedUtilities.nextPaymentDueDate?.toISOString() || EPOCH_ISO_STRING,
    initialPaymentDate: agreementWithParsedUtilities.initialPaymentDate?.toISOString() || null,
    endDate: agreementWithParsedUtilities.endDate?.toISOString() || undefined,
    tenant: tenant ? {
      ...tenant,
      createdAt: tenant.createdAt?.toISOString() || EPOCH_ISO_STRING,
      updatedAt: tenant.updatedAt?.toISOString() || tenant.createdAt?.toISOString() || EPOCH_ISO_STRING,
    } : ({} as ClientTenant), 
    space: space ? {
      ...space,
      area: Number(space.area),
      utilityProrationShare: Number(space.utilityProrationShare),
      monthlyRentalPrice: Number(space.monthlyRentalPrice),
      createdAt: space.createdAt?.toISOString() || EPOCH_ISO_STRING,
      updatedAt: space.updatedAt?.toISOString() || space.createdAt?.toISOString() || EPOCH_ISO_STRING,
      building: building ? {
        ...building,
        createdAt: building.createdAt?.toISOString() || EPOCH_ISO_STRING,
        updatedAt: building.updatedAt?.toISOString() || building.createdAt?.toISOString() || EPOCH_ISO_STRING,
        penaltyPolicyTiers: building.penaltyPolicyTiers?.map(pt => ({ ...pt, feeValue: Number(pt.feeValue) })) || [],
      } : ({} as ClientBuilding),
    } : ({} as ClientSpace), 
    bills: (agreementWithParsedUtilities.bills || []).map(bill => ({
      ...bill,
      rentAmount: Number(bill.rentAmount),
      penaltyAmount: bill.penaltyAmount ? Number(bill.penaltyAmount) : null,
      totalAmount: Number(bill.totalAmount),
      createdAt: bill.createdAt?.toISOString() || EPOCH_ISO_STRING,
      updatedAt: bill.updatedAt?.toISOString() || bill.createdAt?.toISOString() || EPOCH_ISO_STRING,
      billDate: bill.billDate?.toISOString() || EPOCH_ISO_STRING,
      dueDate: bill.dueDate?.toISOString() || EPOCH_ISO_STRING,
      paymentDate: bill.paymentDate?.toISOString() || null,
      utilityBreakdown: (bill.utilityBreakdown || []).map(ub => ({ ...ub, amount: Number(ub.amount) })),
    })),
  };
};


async function TenantPortalDataFetcher({ agreementId }: { agreementId?: string }) {
  const portalData = await getTenantPortalDashboardDataAction();
  
  let serializedData: SerializedTenantPortalData | null = null;
  let selectedAgreement: ClientAgreement | null = null;

  if (portalData.agreements.length > 0) {
    const allSerializedAgreements = portalData.agreements.map(serializeAgreementData);

    if (agreementId) {
      selectedAgreement = allSerializedAgreements.find(ag => ag.id === agreementId) || allSerializedAgreements[0];
    } else {
      selectedAgreement = allSerializedAgreements[0];
    }
    
    serializedData = {
      agreements: allSerializedAgreements,
      selectedAgreement: selectedAgreement,
      error: portalData.error,
    };

  } else { 
    serializedData = {
        agreements: [],
        selectedAgreement: null,
        error: portalData.error || "No active agreement found or failed to load data.",
    };
  }
  
  return <CustomerDashboardClientPage initialData={serializedData} />;
}

export default function CustomerDashboardServerPage({
  searchParams,
}: {
  searchParams?: { agreementId?: string };
}) {
  const agreementId = searchParams?.agreementId;

  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary"/></div>}>
      <TenantPortalDataFetcher agreementId={agreementId} />
    </Suspense>
  );
}
