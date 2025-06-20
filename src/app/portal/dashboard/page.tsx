
import React, { Suspense } from 'react';
import { PageHeader } from '@/components/custom/PageHeader';
import { Loader2, User } from 'lucide-react';
import type { PenaltyTier as PenaltyTierPrisma, Agreement as AgreementPrisma, Bill as BillPrisma, Space as SpacePrisma, Building as BuildingPrisma, Tenant as TenantPrisma } from '@prisma/client';
import { format, parseISO, isBefore, startOfDay, differenceInDays, addMonths } from 'date-fns';
import { getTenantPortalDashboardDataAction, type PortalAgreementWithRelations } from './actions';
import { CustomerDashboardClientPage } from './client-page'; // Import the new client component

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
  return {
    ...agreementWithParsedUtilities,
    createdAt: agreementWithParsedUtilities.createdAt.toISOString(),
    updatedAt: agreementWithParsedUtilities.updatedAt.toISOString(),
    startDate: agreementWithParsedUtilities.startDate.toISOString(),
    nextPaymentDueDate: agreementWithParsedUtilities.nextPaymentDueDate.toISOString(),
    initialPaymentDate: agreementWithParsedUtilities.initialPaymentDate?.toISOString() || null,
    endDate: agreementWithParsedUtilities.endDate?.toISOString() || undefined,
    tenant: {
      ...agreementWithParsedUtilities.tenant,
      createdAt: agreementWithParsedUtilities.tenant.createdAt.toISOString(),
      updatedAt: agreementWithParsedUtilities.tenant.updatedAt.toISOString(),
    },
    space: {
      ...agreementWithParsedUtilities.space,
      createdAt: agreementWithParsedUtilities.space.createdAt.toISOString(),
      updatedAt: agreementWithParsedUtilities.space.updatedAt.toISOString(),
      building: {
        ...agreementWithParsedUtilities.space.building,
        createdAt: agreementWithParsedUtilities.space.building.createdAt.toISOString(),
        updatedAt: agreementWithParsedUtilities.space.building.updatedAt.toISOString(),
        penaltyPolicyTiers: agreementWithParsedUtilities.space.building.penaltyPolicyTiers.map(pt => ({ ...pt })),
      }
    },
    bills: agreementWithParsedUtilities.bills.map(bill => ({
      ...bill,
      createdAt: bill.createdAt.toISOString(),
      updatedAt: bill.updatedAt.toISOString(),
      billDate: bill.billDate.toISOString(),
      dueDate: bill.dueDate.toISOString(),
      paymentDate: bill.paymentDate?.toISOString() || null,
      // utilityBreakdown is already parsed in the action to ParsedUtilityItemForAction[]
      // which should be compatible with ClientUtilityBreakdownItem[]
      utilityBreakdown: bill.utilityBreakdown.map(ub => ({ ...ub })), 
    })),
  };
};


async function TenantPortalDataFetcher() {
  // portalData will now have bills with utilityBreakdown already parsed by the action
  const portalData = await getTenantPortalDashboardDataAction();
  
  let serializedData: SerializedTenantPortalData | null = null;

  if (portalData.agreement) {
    serializedData = {
      // Serialize the rest of the dates
      agreement: serializeAgreementData(portalData.agreement),
      aiGeneratedAgreementText: portalData.aiGeneratedAgreementText,
      error: portalData.error,
    };
  } else if (portalData.error) {
    serializedData = {
        agreement: null,
        aiGeneratedAgreementText: null,
        error: portalData.error,
    }
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
