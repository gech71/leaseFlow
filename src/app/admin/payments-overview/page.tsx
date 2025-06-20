
// REMOVED "use client"; - This is now a Server Component module

import React, { Suspense } from 'react'; // React is needed for Suspense
import { Loader2 } from 'lucide-react';
import type { PenaltyTier as PenaltyTierPrisma, Space as SpacePrisma, Bill as BillPrisma, Agreement as AgreementPrisma, Tenant as TenantPrisma, Building as BuildingPrismaType, UtilityBreakdownItem as UtilityBreakdownItemPrisma } from '@prisma/client';
import { format, parseISO } from 'date-fns'; // parseISO might be needed in serialization if dates are strings already
import { getPaymentsOverviewDataAction, type PaymentsOverviewData, type PaymentsOverviewBill } from './actions';
import { PaymentsOverviewClientPage, type ClientBill, type ClientSpaceForPotentialRevenue, type ClientPenaltyTier, type ClientBuilding, type ClientSpaceForAgreement, type ClientTenant, type ClientAgreementForBill, type ClientUtilityBreakdownItem } from './client-page'; // Import client page and its types


// Helper function to serialize a single bill with deep relations
const serializeBill = (bill: PaymentsOverviewBill): ClientBill => {
  return {
    ...bill,
    createdAt: bill.createdAt.toISOString(),
    updatedAt: bill.updatedAt.toISOString(),
    billDate: bill.billDate.toISOString(),
    dueDate: bill.dueDate.toISOString(),
    paymentDate: bill.paymentDate?.toISOString() || null,
    agreement: {
      ...bill.agreement,
      createdAt: bill.agreement.createdAt.toISOString(),
      updatedAt: bill.agreement.updatedAt.toISOString(),
      startDate: bill.agreement.startDate.toISOString(),
      nextPaymentDueDate: bill.agreement.nextPaymentDueDate.toISOString(),
      initialPaymentDate: bill.agreement.initialPaymentDate?.toISOString() || null,
      endDate: bill.agreement.endDate?.toISOString() || null,
      tenant: {
        ...bill.agreement.tenant,
        createdAt: bill.agreement.tenant.createdAt.toISOString(),
        updatedAt: bill.agreement.tenant.updatedAt.toISOString(),
      },
      space: {
        ...bill.agreement.space,
        createdAt: bill.agreement.space.createdAt.toISOString(),
        updatedAt: bill.agreement.space.updatedAt.toISOString(),
        building: {
          ...bill.agreement.space.building,
          createdAt: bill.agreement.space.building.createdAt.toISOString(),
          updatedAt: bill.agreement.space.building.updatedAt.toISOString(),
          penaltyPolicyTiers: bill.agreement.space.building.penaltyPolicyTiers.map(pt => ({ ...pt })),
        }
      }
    },
    utilityBreakdown: bill.utilityBreakdown.map(ub => ({ ...ub })),
  };
};

// Helper function to serialize a single space
const serializeSpace = (space: SpacePrisma): ClientSpaceForPotentialRevenue => {
  return {
    ...space,
    createdAt: space.createdAt.toISOString(),
    updatedAt: space.updatedAt.toISOString(),
  };
};


async function PaymentsOverviewDataFetcher() {
  const data: PaymentsOverviewData = await getPaymentsOverviewDataAction();
  
  const serializedBills: ClientBill[] = data.bills.map(serializeBill);
  const serializedSpaces: ClientSpaceForPotentialRevenue[] = data.spaces.map(serializeSpace);

  return <PaymentsOverviewClientPage initialBills={serializedBills} initialSpaces={serializedSpaces} />;
}

export default function PaymentsOverviewServerPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary"/></div>}>
      <PaymentsOverviewDataFetcher />
    </Suspense>
  );
}
