
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { getBillingPageDataAction, type BillingPageData } from './actions';
import { BillingClientPage, type SerializedBillingPageData } from './client-page';
import type { Agreement as AgreementPrisma, Bill as BillPrisma, Space as SpacePrisma, Building as BuildingPrismaType, Tenant as TenantPrisma, UtilityBreakdownItem as UtilityBreakdownItemPrisma, PenaltyTier as PenaltyTierPrisma } from '@prisma/client';

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
            building: ag.space.building ? { // Safety check for building
                ...(ag.space.building as BuildingPrismaType & { penaltyPolicyTiers: PenaltyTierPrisma[] }), 
                createdAt: ag.space.building.createdAt.toISOString(),
                updatedAt: ag.space.building.updatedAt?.toISOString() || ag.space.building.createdAt.toISOString(),
                penaltyPolicyTiers: (ag.space.building.penaltyPolicyTiers || []).map(pt => ({...pt}))
            } : null // Provide null if building is missing
        },
    })),
    spaces: data.spaces.map(s => ({ 
        ...s, 
        createdAt: s.createdAt.toISOString(), 
        updatedAt: s.updatedAt?.toISOString() || s.createdAt.toISOString(),
        building: s.building ? { 
            ...(s.building as BuildingPrismaType & { penaltyPolicyTiers: PenaltyTierPrisma[] }), 
            createdAt: s.building.createdAt.toISOString(),
            updatedAt: s.building.updatedAt?.toISOString() || s.building.createdAt.toISOString(),
            penaltyPolicyTiers: (s.building.penaltyPolicyTiers || []).map(pt => ({...pt}))
        } : null
    })),
    buildings: data.buildings.map(b => ({ 
        ...b, 
        createdAt: b.createdAt.toISOString(), 
        updatedAt: b.updatedAt?.toISOString() || b.createdAt.toISOString(),
        penaltyPolicyTiers: (b.penaltyPolicyTiers || []).map(pt => ({...pt})) 
    })),
    bills: data.bills.map(b => ({
        ...b,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt?.toISOString() || b.createdAt.toISOString(),
        billDate: b.billDate.toISOString(),
        dueDate: b.dueDate.toISOString(),
        paymentDate: b.paymentDate?.toISOString() || null,
        utilityBreakdown: (b.utilityBreakdown || []).map(ub => ({...ub})),
        agreement: { 
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
                building: b.agreement.space.building ? {
                     ...(b.agreement.space.building as BuildingPrismaType & { penaltyPolicyTiers: PenaltyTierPrisma[] }),
                     createdAt: b.agreement.space.building.createdAt.toISOString(),
                     updatedAt: b.agreement.space.building.updatedAt?.toISOString() || b.agreement.space.building.createdAt.toISOString(),
                     penaltyPolicyTiers: (b.agreement.space.building.penaltyPolicyTiers || []).map(pt => ({...pt}))
                } : null
            },
        }
    })),
    buildingMonthlyUtilities: data.buildingMonthlyUtilities.map(bu => ({
        ...bu,
        createdAt: bu.createdAt.toISOString(),
        updatedAt: bu.updatedAt?.toISOString() || bu.createdAt.toISOString(),
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

