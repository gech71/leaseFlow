

export interface PenaltyTier {
  id?: string; 
  fromDay: number;
  toDay?: number | null; 
  feeType: 'Fixed' | 'Percentage';
  feeValue: number;
  scope: 'Building' | 'Floor' | 'SpecificSpaces';
  applicableFloor?: string | null; // Prisma schema allows null
  applicableSpaceIdNames?: string[] | null; // Prisma schema allows null for the array itself
  buildingId?: string; // Foreign key to Building
}

export interface Building {
  id: string;
  name: string;
  address?: string | null; // Prisma schema allows null
  penaltyPolicyTiers: PenaltyTier[]; // Relation, should be array of PenaltyTier objects
  createdAt: string; 
  updatedAt?: string;
  spaces?: Space[]; // Relation
  buildingMonthlyUtilities?: BuildingMonthlyUtilities[]; // Relation
}

export interface Space {
  id: string;
  buildingId: string; 
  buildingName: string; // Denormalized
  spaceIdName: string; 
  area: number; 
  floor: string; 
  utilityProrationShare: number; 
  monthlyRentalPrice: number;
  isOccupied: boolean;
  tenantId?: string | null; 
  createdAt: string; 
  updatedAt?: string;
  tenant?: Tenant | null; 
  building?: Building; // Relation
  agreements?: Agreement[]; // Relation
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
  rentedSpaceId?: string | null; // Prisma schema allows null
  createdAt: string; 
  updatedAt?: string;
  rentedSpace?: Space | null; 
  agreements?: Agreement[]; 
  bills?: Bill[]; // Relation
}

export interface Agreement {
  id:string;
  tenantId: string;
  spaceId: string;
  agreementText: string;
  startDate: string; 
  monthlyRentalPrice: number;
  additionalTerms?: string | null; 
  createdAt: string; 
  updatedAt?: string; 
  paymentTermMonths: number;
  initialPaymentMonths: number;
  nextPaymentDueDate: string; 

  initialPaymentAmount?: number | null;
  initialPaymentMethod?: string | null;
  initialPaymentReference?: string | null;
  initialPaymentBankOrWalletName?: string | null;
  initialPaymentDate?: string | null; 
  endDate?: string | null; 

  tenant: Tenant; // Relation - assuming always included when needed
  space: Space;   // Relation - assuming always included when needed
  bills?: Bill[]; 
}

export interface UtilityBreakdownItem {
  id?: string;
  name: string;
  amount: number;
  billId?: string; // Foreign key
}

export interface BuildingUtilityItem {
  id?: string; 
  name: string;
  totalCost: number;
  appliesToScope: 'Building' | 'Floor' | 'SpecificSpaces'; // Matches Prisma Enum
  applicableFloor?: string | null; 
  applicableSpaceIdNames?: string[] | null; 
  monthlyUtilitiesId?: string | null; 
}

export interface BuildingMonthlyUtilities {
  id: string;
  buildingId: string; 
  buildingName: string; // Denormalized
  year: number;
  month: number; // 0-11
  utilities: BuildingUtilityItem[];
  createdAt: string;
  updatedAt?: string; 
  building?: Building; 
}

export interface Bill {
  id: string;
  agreementId: string;
  tenantId: string; // Prisma schema has this
  billDate: string;
  dueDate: string;
  rentAmount: number;
  utilityBreakdown: UtilityBreakdownItem[]; // This is a relation, client type might be flat array
  penaltyAmount?: number | null; // Prisma schema allows null
  totalAmount: number;
  status: 'Pending' | 'Paid' | 'Overdue' | 'PendingVerification'; // Prisma Enum BillStatus
  paymentDate?: string | null;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  bankOrWalletName?: string | null;
  paymentProofUrl?: string | null;
  adminVerifiedPayment?: boolean | null; // Prisma schema allows null
  tenantPaymentNotes?: string | null;
  adminVerificationNotes?: string | null;
  createdAt: string; 
  updatedAt: string; 

  agreement: Agreement; // Relation, assuming always included
}

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
