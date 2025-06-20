
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { getBillingPageDataAction, type BillingPageData } from './actions';
import { BillingClientPage, type SerializedBillingPageData } from './client-page';
import type { Agreement as AgreementPrisma, Bill as BillPrisma, Space as SpacePrisma, Building as BuildingPrismaType, Tenant as TenantPrismaOriginal, UtilityBreakdownItem as UtilityBreakdownItemPrismaOriginal, PenaltyTier as PenaltyTierPrisma, Prisma } from '@prisma/client';

const EPOCH_ISO_STRING = new Date(0).toISOString();

// Define a simple type for utility items after parsing from JSON (if applicable)
interface SerializedParsedUtilityItem {
  id?: string;
  name: string;
  amount: number;
}

// Helper function to serialize the data (convert Dates to ISO strings)
const serializeBillingPageData = (data: BillingPageData): SerializedBillingPageData => {
  return {
    agreements: data.agreements.map(ag => ({
        ...ag,
        createdAt: ag.createdAt ? ag.createdAt.toISOString() : EPOCH_ISO_STRING,
        updatedAt: ag.updatedAt ? ag.updatedAt.toISOString() : (ag.createdAt ? ag.createdAt.toISOString() : EPOCH_ISO_STRING),
        startDate: ag.startDate ? ag.startDate.toISOString() : EPOCH_ISO_STRING,
        nextPaymentDueDate: ag.nextPaymentDueDate ? ag.nextPaymentDueDate.toISOString() : EPOCH_ISO_STRING,
        initialPaymentDate: ag.initialPaymentDate?.toISOString() || null,
        endDate: ag.endDate?.toISOString() || null,
        tenant: ag.tenant ? {
          ...ag.tenant,
          createdAt: ag.tenant.createdAt ? ag.tenant.createdAt.toISOString() : EPOCH_ISO_STRING,
          updatedAt: ag.tenant.updatedAt ? ag.tenant.updatedAt.toISOString() : (ag.tenant.createdAt ? ag.tenant.createdAt.toISOString() : EPOCH_ISO_STRING)
        } : null,
        space: ag.space ? {
            ...ag.space,
            createdAt: ag.space.createdAt ? ag.space.createdAt.toISOString() : EPOCH_ISO_STRING,
            updatedAt: ag.space.updatedAt ? ag.space.updatedAt.toISOString() : (ag.space.createdAt ? ag.space.createdAt.toISOString() : EPOCH_ISO_STRING),
            building: ag.space.building ? {
                ...(ag.space.building as BuildingPrismaType & { penaltyPolicyTiers: PenaltyTierPrisma[], spaces: SpacePrisma[] }),
                createdAt: ag.space.building.createdAt ? ag.space.building.createdAt.toISOString() : EPOCH_ISO_STRING,
                updatedAt: ag.space.building.updatedAt ? ag.space.building.updatedAt.toISOString() : (ag.space.building.createdAt ? ag.space.building.createdAt.toISOString() : EPOCH_ISO_STRING),
                penaltyPolicyTiers: (ag.space.building.penaltyPolicyTiers || []).map(pt => ({...pt})),
                spaces: (ag.space.building.spaces || []).map(s => ({
                    ...s,
                    createdAt: s.createdAt ? s.createdAt.toISOString() : EPOCH_ISO_STRING,
                    updatedAt: s.updatedAt?.toISOString() || (s.createdAt ? s.createdAt.toISOString() : EPOCH_ISO_STRING)
                }))
            } : null
        } : null,
    })),
    spaces: data.spaces.map(s => ({
        ...s,
        createdAt: s.createdAt ? s.createdAt.toISOString() : EPOCH_ISO_STRING,
        updatedAt: s.updatedAt ? s.updatedAt.toISOString() : (s.createdAt ? s.createdAt.toISOString() : EPOCH_ISO_STRING),
        building: s.building ? {
            ...(s.building as BuildingPrismaType & { penaltyPolicyTiers: PenaltyTierPrisma[], spaces: SpacePrisma[] }),
            createdAt: s.building.createdAt ? s.building.createdAt.toISOString() : EPOCH_ISO_STRING,
            updatedAt: s.building.updatedAt ? s.building.updatedAt.toISOString() : (s.building.createdAt ? s.building.createdAt.toISOString() : EPOCH_ISO_STRING),
            penaltyPolicyTiers: (s.building.penaltyPolicyTiers || []).map(pt => ({...pt})),
             spaces: (s.building.spaces || []).map(sp => ({
                ...sp,
                createdAt: sp.createdAt ? sp.createdAt.toISOString() : EPOCH_ISO_STRING,
                updatedAt: sp.updatedAt?.toISOString() || (sp.createdAt ? sp.createdAt.toISOString() : EPOCH_ISO_STRING)
            }))
        } : null
    })),
    buildings: data.buildings.map(b => ({
        ...b,
        createdAt: b.createdAt ? b.createdAt.toISOString() : EPOCH_ISO_STRING,
        updatedAt: b.updatedAt ? b.updatedAt.toISOString() : (b.createdAt ? b.createdAt.toISOString() : EPOCH_ISO_STRING),
        penaltyPolicyTiers: (b.penaltyPolicyTiers || []).map(pt => ({...pt})),
        spaces: (b.spaces || []).map(s => ({
            ...s,
            createdAt: s.createdAt ? s.createdAt.toISOString() : EPOCH_ISO_STRING,
            updatedAt: s.updatedAt?.toISOString() || (s.createdAt ? s.createdAt.toISOString() : EPOCH_ISO_STRING)
        }))
    })),
    bills: data.bills.map(b => {
      const billCreatedAt = b.createdAt ? b.createdAt.toISOString() : EPOCH_ISO_STRING;
      const billUpdatedAt = b.updatedAt ? b.updatedAt.toISOString() : billCreatedAt;

      return {
        ...b,
        createdAt: billCreatedAt,
        updatedAt: billUpdatedAt,
        billDate: b.billDate ? b.billDate.toISOString() : EPOCH_ISO_STRING,
        dueDate: b.dueDate ? b.dueDate.toISOString() : EPOCH_ISO_STRING,
        paymentDate: b.paymentDate?.toISOString() || null,
        utilityBreakdown: (b.utilityBreakdown || []).map(ub => ({...ub}) as SerializedParsedUtilityItem),
        agreement: b.agreement ? {
            ...b.agreement,
            createdAt: b.agreement.createdAt ? b.agreement.createdAt.toISOString() : EPOCH_ISO_STRING,
            updatedAt: b.agreement.updatedAt ? b.agreement.updatedAt.toISOString() : (b.agreement.createdAt ? b.agreement.createdAt.toISOString() : EPOCH_ISO_STRING),
            startDate: b.agreement.startDate ? b.agreement.startDate.toISOString() : EPOCH_ISO_STRING,
            nextPaymentDueDate: b.agreement.nextPaymentDueDate ? b.agreement.nextPaymentDueDate.toISOString() : EPOCH_ISO_STRING,
            initialPaymentDate: b.agreement.initialPaymentDate?.toISOString() || null,
            endDate: b.agreement.endDate?.toISOString() || null,
            tenant: b.agreement.tenant ? {
              ...b.agreement.tenant,
              createdAt: b.agreement.tenant.createdAt ? b.agreement.tenant.createdAt.toISOString() : EPOCH_ISO_STRING,
              updatedAt: b.agreement.tenant.updatedAt ? b.agreement.tenant.updatedAt.toISOString() : (b.agreement.tenant.createdAt ? b.agreement.tenant.createdAt.toISOString() : EPOCH_ISO_STRING)
            } : null,
            space: b.agreement.space ? {
                ...b.agreement.space,
                createdAt: b.agreement.space.createdAt ? b.agreement.space.createdAt.toISOString() : EPOCH_ISO_STRING,
                updatedAt: b.agreement.space.updatedAt ? b.agreement.space.updatedAt.toISOString() : (b.agreement.space.createdAt ? b.agreement.space.createdAt.toISOString() : EPOCH_ISO_STRING),
                building: b.agreement.space.building ? {
                     ...(b.agreement.space.building as BuildingPrismaType & { penaltyPolicyTiers: PenaltyTierPrisma[], spaces: SpacePrisma[] }),
                     createdAt: b.agreement.space.building.createdAt ? b.agreement.space.building.createdAt.toISOString() : EPOCH_ISO_STRING,
                     updatedAt: b.agreement.space.building.updatedAt ? b.agreement.space.building.updatedAt.toISOString() : (b.agreement.space.building.createdAt ? b.agreement.space.building.createdAt.toISOString() : EPOCH_ISO_STRING),
                     penaltyPolicyTiers: (b.agreement.space.building.penaltyPolicyTiers || []).map(pt => ({...pt})),
                     spaces: (b.agreement.space.building.spaces || []).map(s => ({
                        ...s,
                        createdAt: s.createdAt ? s.createdAt.toISOString() : EPOCH_ISO_STRING,
                        updatedAt: s.updatedAt?.toISOString() || (s.createdAt ? s.createdAt.toISOString() : EPOCH_ISO_STRING)
                    }))
                } : null
            } : null,
        } : null,
      };
    }),
    buildingMonthlyUtilities: data.buildingMonthlyUtilities.map(bu => ({
        ...bu,
        createdAt: bu.createdAt ? bu.createdAt.toISOString() : EPOCH_ISO_STRING,
        updatedAt: bu.updatedAt ? bu.updatedAt.toISOString() : (bu.createdAt ? bu.createdAt.toISOString() : EPOCH_ISO_STRING),
        utilities: (bu.utilities || []).map(u => ({...u}))
    })),
  };
};

// Server Component to fetch initial data
async function BillingDataFetcher() {
  const initialRawData = await getBillingPageDataAction();
  const serializableData = serializeBillingPageData(initialRawData);
  return <BillingClientPage initialData={serializableData} />;
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"/></div>}>
      <BillingDataFetcher />
    </Suspense>
  );
}
