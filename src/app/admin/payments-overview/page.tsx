
export const dynamic = 'force-dynamic';

import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import type { PenaltyTier as PenaltyTierPrisma, Space as SpacePrisma, Bill as BillPrisma, Agreement as AgreementPrisma, Tenant as TenantPrisma, Building as BuildingPrismaType, UtilityBreakdownItem as UtilityBreakdownItemPrisma } from '@prisma/client';
import { getPaymentsOverviewDataAction, type PaymentsOverviewData, type PaymentsOverviewBill } from './actions';
import { PaymentsOverviewClientPage, type ClientBill, type ClientSpaceForPotentialRevenue, type ClientPenaltyTier, type ClientBuilding, type ClientSpaceForAgreement, type ClientTenant, type ClientAgreementForBill, type ClientUtilityBreakdownItem } from './client-page';

const EPOCH_ISO_STRING = new Date(0).toISOString();

const serializeBill = (bill: PaymentsOverviewBill): ClientBill => {
  const agreement = bill.agreement;
  const tenant = agreement?.tenant;
  const space = agreement?.space;
  const building = space?.building;

  return {
    ...bill,
    rentAmount: Number(bill.rentAmount),
    penaltyAmount: bill.penaltyAmount ? Number(bill.penaltyAmount) : null,
    totalAmount: Number(bill.totalAmount),
    createdAt: bill.createdAt?.toISOString() || EPOCH_ISO_STRING,
    updatedAt: bill.updatedAt?.toISOString() || bill.createdAt?.toISOString() || EPOCH_ISO_STRING,
    billDate: bill.billDate?.toISOString() || EPOCH_ISO_STRING,
    dueDate: bill.dueDate?.toISOString() || EPOCH_ISO_STRING,
    paymentDate: bill.paymentDate?.toISOString() || null,
    agreement: agreement ? {
      ...agreement,
      monthlyRentalPrice: Number(agreement.monthlyRentalPrice),
      initialPaymentAmount: agreement.initialPaymentAmount ? Number(agreement.initialPaymentAmount) : null,
      createdAt: agreement.createdAt?.toISOString() || EPOCH_ISO_STRING,
      updatedAt: agreement.updatedAt?.toISOString() || agreement.createdAt?.toISOString() || EPOCH_ISO_STRING,
      startDate: agreement.startDate?.toISOString() || EPOCH_ISO_STRING,
      nextPaymentDueDate: agreement.nextPaymentDueDate?.toISOString() || EPOCH_ISO_STRING,
      initialPaymentDate: agreement.initialPaymentDate?.toISOString() || null,
      endDate: agreement.endDate?.toISOString() || null,
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
      } : ({} as ClientSpaceForAgreement),
    } : ({} as ClientAgreementForBill),
    utilityBreakdown: bill.utilityBreakdown?.map(ub => ({ ...ub, amount: Number(ub.amount) })) || [],
  };
};

const serializeSpace = (space: SpacePrisma): ClientSpaceForPotentialRevenue => {
  return {
    ...space,
    area: Number(space.area),
    utilityProrationShare: Number(space.utilityProrationShare),
    monthlyRentalPrice: Number(space.monthlyRentalPrice),
    createdAt: space.createdAt?.toISOString() || EPOCH_ISO_STRING,
    updatedAt: space.updatedAt?.toISOString() || space.createdAt?.toISOString() || EPOCH_ISO_STRING,
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
