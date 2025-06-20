
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { getBillingPageDataAction, type BillingPageData } from './actions';
import { BillingClientPage, type SerializedBillingPageData } from './client-page';
import type { Agreement as AgreementPrisma, Bill as BillPrisma, Space as SpacePrisma, Building as BuildingPrisma, Tenant as TenantPrisma, UtilityBreakdownItem as UtilityBreakdownItemPrisma, PenaltyTier as PenaltyTierPrisma } from '@prisma/client';

// Helper function to serialize the data (convert Dates to ISO strings)
const serializeBillingPageData = (data: BillingPageData): SerializedBillingPageData => {
  return {
    agreements: data.agreements.map(ag => ({
        ...ag,
        createdAt: ag.createdAt.toISOString(),
        updatedAt: ag.updatedAt?.toISOString() || ag.createdAt.toISOString(),
        startDate: ag.startDate.toISOString(),
        nextPaymentDueDate: ag.nextPaymentDueDate.toISOString(),
        initialPaymentDate: ag.initialPaymentDate?.toISOString() || null,
        endDate: ag.endDate?.toISOString() || null,
        tenant: { 
          ...ag.tenant, 
          createdAt: ag.tenant.createdAt.toISOString(), 
          updatedAt: ag.tenant.updatedAt?.toISOString() || ag.tenant.createdAt.toISOString() 
        },
        space: { 
            ...ag.space, 
            createdAt: ag.space.createdAt.toISOString(), 
            updatedAt: ag.space.updatedAt?.toISOString() || ag.space.createdAt.toISOString(),
            building: {
                ...(ag.space.building as BuildingPrisma & { penaltyPolicyTiers: PenaltyTierPrisma[] }), 
                createdAt: (ag.space.building as BuildingPrisma).createdAt.toISOString(),
                updatedAt: (ag.space.building as BuildingPrisma).updatedAt?.toISOString() || (ag.space.building as BuildingPrisma).createdAt.toISOString(),
                penaltyPolicyTiers: (ag.space.building as BuildingPrisma & { penaltyPolicyTiers: PenaltyTierPrisma[] }).penaltyPolicyTiers.map(pt => ({...pt}))
            }
        },
    })),
    spaces: data.spaces.map(s => ({ 
        ...s, 
        createdAt: s.createdAt.toISOString(), 
        updatedAt: s.updatedAt?.toISOString() || s.createdAt.toISOString(),
        building: { // Assuming space includes building directly for some use cases. Adjust if not.
            ...(s.building as BuildingPrisma & { penaltyPolicyTiers: PenaltyTierPrisma[] }), // This might need to be fetched if not already on space
            createdAt: (s.building as BuildingPrisma)?.createdAt.toISOString() || new Date().toISOString(), // Fallback
            updatedAt: (s.building as BuildingPrisma)?.updatedAt?.toISOString() || new Date().toISOString(), // Fallback
            penaltyPolicyTiers: (s.building as BuildingPrisma & { penaltyPolicyTiers: PenaltyTierPrisma[] })?.penaltyPolicyTiers?.map(pt => ({...pt})) || []
        }
    })),
    buildings: data.buildings.map(b => ({ 
        ...b, 
        createdAt: b.createdAt.toISOString(), 
        updatedAt: b.updatedAt?.toISOString() || b.createdAt.toISOString(),
        penaltyPolicyTiers: b.penaltyPolicyTiers.map(pt => ({...pt})) 
    })),
    bills: data.bills.map(b => ({
        ...b,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt?.toISOString() || b.createdAt.toISOString(),
        billDate: b.billDate.toISOString(),
        dueDate: b.dueDate.toISOString(),
        paymentDate: b.paymentDate?.toISOString() || null,
        utilityBreakdown: b.utilityBreakdown.map(ub => ({...ub})),
        agreement: { // Ensure deep serialization for agreement within bill
            ...b.agreement,
            createdAt: b.agreement.createdAt.toISOString(),
            updatedAt: b.agreement.updatedAt?.toISOString() || b.agreement.createdAt.toISOString(),
            startDate: b.agreement.startDate.toISOString(),
            nextPaymentDueDate: b.agreement.nextPaymentDueDate.toISOString(),
            initialPaymentDate: b.agreement.initialPaymentDate?.toISOString() || null,
            endDate: b.agreement.endDate?.toISOString() || null,
            tenant: { 
              ...b.agreement.tenant, 
              createdAt: b.agreement.tenant.createdAt.toISOString(), 
              updatedAt: b.agreement.tenant.updatedAt?.toISOString() || b.agreement.tenant.createdAt.toISOString() 
            },
            space: { 
                ...b.agreement.space, 
                createdAt: b.agreement.space.createdAt.toISOString(), 
                updatedAt: b.agreement.space.updatedAt?.toISOString() || b.agreement.space.createdAt.toISOString(),
                building: {
                     ...(b.agreement.space.building as BuildingPrisma & { penaltyPolicyTiers: PenaltyTierPrisma[] }),
                     createdAt: (b.agreement.space.building as BuildingPrisma).createdAt.toISOString(),
                     updatedAt: (b.agreement.space.building as BuildingPrisma).updatedAt?.toISOString() || (b.agreement.space.building as BuildingPrisma).createdAt.toISOString(),
                     penaltyPolicyTiers: (b.agreement.space.building as BuildingPrisma & { penaltyPolicyTiers: PenaltyTierPrisma[] }).penaltyPolicyTiers.map(pt => ({...pt}))
                }
            },
        }
    })),
    buildingMonthlyUtilities: data.buildingMonthlyUtilities.map(bu => ({
        ...bu,
        createdAt: bu.createdAt.toISOString(),
        updatedAt: bu.updatedAt?.toISOString() || bu.createdAt.toISOString(),
        utilities: bu.utilities.map(u => ({...u}))
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
