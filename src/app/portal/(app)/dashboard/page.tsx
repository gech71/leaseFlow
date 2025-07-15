

import React, { Suspense } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Loader2, User } from 'lucide-react';
import type { PenaltyTier as PenaltyTierPrisma, Agreement as AgreementPrisma, Bill as BillPrisma, Space as SpacePrisma, Building as BuildingPrisma, Tenant as TenantPrisma } from '@prisma/client';
import { format, parseISO, isBefore, startOfDay, differenceInDays, addMonths } from 'date-fns';
import { getTenantPortalDashboardDataAction, type PortalAgreementWithRelations } from '../../dashboard/actions';
import { CustomerDashboardClientPage } from '../../dashboard/client-page'; // Import the new client component

const EPOCH_ISO_STRING = new Date(0).toISOString();

// Serialized types for props passed to Client Component (Dates are strings)
export interface ClientPenaltyTier extends Omit<PenaltyTierPrisma, 'id'> { id?: string; }
export interface ClientBuilding extends Omit<BuildingPrisma, 'createdAt' | 'updatedAt' | 'penaltyPolicyTiers'> {
  createdAt: string;
  updatedAt: string;
  penaltyPolicyTiers: ClientPenaltyTier[];
}
export interface ClientSpace extends Omit<SpacePrisma, 'createdAt' | 'updatedAt' | 'building'> {
  createdAt: string;
  updatedAt: string;
  building: ClientBuilding;
}
export interface ClientTenant extends Omit<TenantPrisma, 'createdAt' | 'updatedAt'> {
  createdAt: string;
  updatedAt: string;
}

// Simplified utility breakdown item type for client-side
export interface ClientUtilityBreakdownItem {
  id?: string;
  name: string;
  amount: number;
}

export interface ClientBill extends Omit<BillPrisma, 'createdAt' | 'updatedAt' | 'billDate' | 'dueDate' | 'paymentDate' | 'utilityBreakdown'> {
  createdAt: string;
  updatedAt: string;
  billDate: string;
  dueDate: string;
  paymentDate?: string | null;
  utilityBreakdown: ClientUtilityBreakdownItem[]; // Use the simplified type
  // For client-side processing:
  currentStatus?: BillPrisma['status']; // This will be set/updated client-side
  calculatedPenalty?: number | null; // Calculated client-side
  calculatedTotal?: number; // Calculated client-side
}

export interface ClientAgreement extends Omit<AgreementPrisma, 'createdAt' | 'updatedAt' | 'startDate' | 'nextPaymentDueDate' | 'initialPaymentDate' | 'endDate' | 'tenant' | 'space' | 'bills'> {
  createdAt: string;
  updatedAt: string;
  startDate: string;
  nextPaymentDueDate: string;
  initialPaymentDate?: string | null;
  endDate?: string | null; 
  tenant: ClientTenant;
  space: ClientSpace;
  bills: ClientBill[];
}

export interface SerializedTenantPortalData {
  agreement: ClientAgreement | null;
  aiGeneratedAgreementText: string | null;
  error?: string;
}

// Helper function to serialize a single agreement with deep relations
const serializeAgreementData = (agreementWithParsedUtilities: PortalAgreementWithRelations): ClientAgreement => {
  const tenant = agreementWithParsedUtilities.tenant;
  const space = agreementWithParsedUtilities.space;
  const building = space?.building;

  return {
    ...agreementWithParsedUtilities,
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
    } : ({} as ClientTenant), // Provide a default empty object if tenant is null
    space: space ? {
      ...space,
      createdAt: space.createdAt?.toISOString() || EPOCH_ISO_STRING,
      updatedAt: space.updatedAt?.toISOString() || space.createdAt?.toISOString() || EPOCH_ISO_STRING,
      building: building ? {
        ...building,
        createdAt: building.createdAt?.toISOString() || EPOCH_ISO_STRING,
        updatedAt: building.updatedAt?.toISOString() || building.createdAt?.toISOString() || EPOCH_ISO_STRING,
        penaltyPolicyTiers: building.penaltyPolicyTiers?.map(pt => ({ ...pt })) || [],
      } : ({} as ClientBuilding), // Default empty object
    } : ({} as ClientSpace), // Default empty object
    bills: (agreementWithParsedUtilities.bills || []).map(bill => ({
      ...bill,
      createdAt: bill.createdAt?.toISOString() || EPOCH_ISO_STRING,
      updatedAt: bill.updatedAt?.toISOString() || bill.createdAt?.toISOString() || EPOCH_ISO_STRING,
      billDate: bill.billDate?.toISOString() || EPOCH_ISO_STRING,
      dueDate: bill.dueDate?.toISOString() || EPOCH_ISO_STRING,
      paymentDate: bill.paymentDate?.toISOString() || null,
      utilityBreakdown: (bill.utilityBreakdown || []).map(ub => ({ ...ub })), 
    })),
  };
};


async function TenantPortalDataFetcher() {
  const portalData = await getTenantPortalDashboardDataAction();
  
  let serializedData: SerializedTenantPortalData | null = null;

  if (portalData.agreement) {
    serializedData = {
      agreement: serializeAgreementData(portalData.agreement),
      aiGeneratedAgreementText: portalData.aiGeneratedAgreementText,
      error: portalData.error,
    };
  } else { // Handle cases where portalData.agreement is null (e.g., error or no active agreement)
    serializedData = {
        agreement: null,
        aiGeneratedAgreementText: null,
        error: portalData.error || "No active agreement found or failed to load data.", // Provide a default error if none
    };
  }
  
  return <CustomerDashboardClientPage initialData={serializedData} />;
}

export default function CustomerDashboardServerPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary"/></div>}>
      <TenantPortalDataFetcher />
    </Suspense>
  );
}
