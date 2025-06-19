

// This file defines shared data structures, especially for client-side representations
// where Date objects from Prisma are typically serialized to strings (ISO format).

export interface PenaltyTier {
  id?: string; 
  fromDay: number;
  toDay?: number | null; 
  feeType: 'Fixed' | 'Percentage';
  feeValue: number;
  scope: 'Building' | 'Floor' | 'SpecificSpaces';
  applicableFloor?: string | null;
  applicableSpaceIdNames?: string[] | null;
  buildingId?: string; 
}

export interface Building {
  id: string;
  name: string;
  address?: string | null;
  penaltyPolicyTiers: PenaltyTier[];
  createdAt: string; // ISO Date String
  updatedAt?: string | null; // ISO Date String
  spaces?: Space[]; 
  buildingMonthlyUtilities?: BuildingMonthlyUtilities[];
}

export interface Space {
  id: string;
  buildingId: string; 
  buildingName: string; 
  spaceIdName: string; 
  area: number; 
  floor: string; 
  utilityProrationShare: number; 
  monthlyRentalPrice: number;
  isOccupied: boolean;
  tenantId?: string | null; 
  createdAt: string; // ISO Date String
  updatedAt?: string | null; // ISO Date String
  tenant?: Tenant | null; 
  building?: Building; 
  agreements?: Agreement[];
}

export interface Tenant {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  alternativePhone?: string | null;
  nationalId?: string | null;
  representativeName?: string | null;
  representativePhone?: string | null;
  rentedSpaceId?: string | null;
  createdAt: string; // ISO Date String
  updatedAt?: string | null; // ISO Date String
  rentedSpace?: Space | null; 
  agreements?: Agreement[]; 
  bills?: Bill[];
}

export interface Agreement {
  id:string;
  tenantId: string;
  spaceId: string;
  agreementText: string;
  startDate: string; // ISO Date String
  monthlyRentalPrice: number;
  additionalTerms?: string | null; 
  createdAt: string; // ISO Date String
  updatedAt?: string | null; // ISO Date String
  paymentTermMonths: number;
  initialPaymentMonths: number;
  nextPaymentDueDate: string; // ISO Date String

  initialPaymentAmount?: number | null;
  initialPaymentMethod?: string | null;
  initialPaymentReference?: string | null;
  initialPaymentBankOrWalletName?: string | null;
  initialPaymentDate?: string | null; // ISO Date String
  endDate?: string | null; // ISO Date String (calculated if needed)

  tenant?: Tenant; // Optional on base type, usually included where needed
  space?: Space;   // Optional on base type, usually included where needed
  bills?: Bill[]; 
}

export interface UtilityBreakdownItem {
  id?: string; // Present if from DB
  name: string;
  amount: number;
  billId?: string;
}

export interface BuildingUtilityItem {
  id?: string; 
  name: string;
  totalCost: number;
  appliesToScope: 'Building' | 'Floor' | 'SpecificSpaces';
  applicableFloor?: string | null; 
  applicableSpaceIdNames?: string[] | null; 
  monthlyUtilitiesId?: string | null; 
}

export interface BuildingMonthlyUtilities {
  id: string;
  buildingId: string; 
  buildingName: string; 
  year: number;
  month: number; 
  utilities: BuildingUtilityItem[];
  createdAt: string; // ISO Date String
  updatedAt?: string | null; // ISO Date String
  building?: Building; 
}

export interface Bill {
  id: string;
  agreementId: string;
  tenantId: string; 
  billDate: string; // ISO Date String
  dueDate: string; // ISO Date String
  rentAmount: number;
  utilityBreakdown: UtilityBreakdownItem[];
  penaltyAmount?: number | null;
  totalAmount: number;
  status: 'Pending' | 'Paid' | 'Overdue' | 'PendingVerification';
  paymentDate?: string | null; // ISO Date String
  paymentMethod?: string | null;
  paymentReference?: string | null;
  bankOrWalletName?: string | null;
  paymentProofUrl?: string | null;
  adminVerifiedPayment?: boolean | null;
  tenantPaymentNotes?: string | null;
  adminVerificationNotes?: string | null;
  createdAt: string; // ISO Date String
  updatedAt?: string | null; // ISO Date String

  agreement?: Agreement; // Optional on base type, usually included where needed
}

// Input type for the AI agreement generation flow
export interface AgreementInput {
  tenantName: string;
  building: string;
  spaceId: string; 
  spaceArea: number;
  floor: string;
  monthlyRentalPrice: number;
  paymentTermMonths: number;
  initialPaymentMonths: number;
  additionalTerms?: string;
}
