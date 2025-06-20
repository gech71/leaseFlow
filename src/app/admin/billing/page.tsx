
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { getBillingPageDataAction } from './actions'; // Server action now returns SerializedBillingPageData
import { BillingClientPage } from './client-page';
import type { Agreement as AgreementPrisma, Bill as BillPrismaOriginal, Space as SpacePrismaOriginal, Building as BuildingPrismaType, Tenant as TenantPrismaOriginal, UtilityBreakdownItem as UtilityBreakdownItemPrismaOriginal, PenaltyTier as PenaltyTierPrisma, Prisma } from '@prisma/client';


// Define a simple type for utility items after parsing from JSON (if applicable)
export interface SerializedParsedUtilityItem {
  id?: string;
  name: string;
  amount: number;
}

// Client-side representation types, dates as strings
// These types should match the structure of serialized data passed from Server Components

interface ClientPenaltyTier extends Omit<PenaltyTierPrisma, 'id'> { id?: string; } 

interface ClientSpaceForBuilding extends Omit<SpacePrismaOriginal, 'createdAt' | 'updatedAt' | 'tenantId' | 'buildingId' | 'agreements' | 'tenant' | 'building'> {
  createdAt: string;
  updatedAt: string;
  tenantId?: string | null;
  buildingId: string;
}

interface ClientBuilding extends Omit<BuildingPrismaType, 'createdAt' | 'updatedAt' | 'penaltyPolicyTiers' | 'spaces' | 'buildingMonthlyUtilities'> {
  createdAt: string;
  updatedAt: string;
  penaltyPolicyTiers: ClientPenaltyTier[];
  spaces: ClientSpaceForBuilding[];
}


interface ClientSpaceForAgreement extends Omit<SpacePrismaOriginal, 'createdAt' | 'updatedAt' | 'building' | 'tenantId' | 'buildingId' | 'agreements' | 'tenant'> {
  createdAt: string;
  updatedAt: string;
  building: ClientBuilding | null; // Building can be null if space.building relation wasn't fully populated
  tenantId?: string | null;
  buildingId: string;
}

interface ClientTenant extends Omit<TenantPrismaOriginal, 'createdAt' | 'updatedAt' | 'rentedSpaceId' | 'agreements' | 'bills'> {
  createdAt: string;
  updatedAt: string;
  rentedSpaceId?: string | null;
}


interface ClientAgreement extends Omit<AgreementPrisma, 'createdAt' | 'updatedAt' | 'startDate' | 'nextPaymentDueDate' | 'initialPaymentDate' | 'endDate' | 'tenant' | 'space' | 'bills' | 'tenantId' | 'spaceId'> {
  createdAt: string;
  updatedAt: string;
  startDate: string;
  nextPaymentDueDate: string;
  initialPaymentDate?: string | null;
  endDate?: string | null; 
  tenant: ClientTenant | null; // Tenant can be null
  space: ClientSpaceForAgreement | null; // Space can be null
  tenantId: string;
  spaceId: string;
}


interface ClientBill extends Omit<BillPrismaOriginal, 'createdAt' | 'updatedAt' | 'billDate' | 'dueDate' | 'paymentDate' | 'agreement' | 'utilityBreakdown' | 'tenantId' | 'agreementId'> {
  createdAt: string;
  updatedAt: string;
  billDate: string;
  dueDate: string;
  paymentDate?: string | null;
  agreement: ClientAgreement | null; // Agreement can be null
  utilityBreakdown: SerializedParsedUtilityItem[]; // Matches the parsed structure
  tenantId: string;
  agreementId: string;
}

interface ClientBuildingMonthlyUtilities extends Omit<BuildingMonthlyUtilitiesPrisma, 'createdAt' | 'updatedAt' | 'utilities' | 'buildingId' | 'building'> {
    createdAt: string;
    updatedAt: string;
    utilities: Prisma.BuildingUtilityItemGetPayload<{}>[];
    buildingId: string;
}

export interface SerializedBillingPageData {
  agreements: ClientAgreement[];
  spaces: (Omit<SpacePrismaOriginal, 'createdAt' | 'updatedAt'| 'building' | 'tenantId' | 'buildingId' | 'agreements' | 'tenant'> & { createdAt: string; updatedAt: string; building: ClientBuilding | null, tenantId?: string | null, buildingId: string; })[];
  buildings: ClientBuilding[];
  bills: ClientBill[];
  buildingMonthlyUtilities: ClientBuildingMonthlyUtilities[];
}


// Server Component to fetch initial data
async function BillingDataFetcher() {
  // getBillingPageDataAction now returns SerializedBillingPageData directly
  const serializableData = await getBillingPageDataAction();
  return <BillingClientPage initialData={serializableData} />;
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"/></div>}>
      <BillingDataFetcher />
    </Suspense>
  );
}

