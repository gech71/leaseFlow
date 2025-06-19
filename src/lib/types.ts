

export interface PenaltyTier {
  id?: string; // Optional ID if fetched from DB
  fromDay: number;
  toDay?: number | null; 
  feeType: 'Fixed' | 'Percentage';
  feeValue: number;
  scope: 'Building' | 'Floor' | 'SpecificSpaces';
  applicableFloor?: string; 
  applicableSpaceIdNames?: string[]; 
}

export interface Building {
  id: string;
  name: string;
  address?: string;
  penaltyPolicyTiers?: PenaltyTier[]; 
  createdAt: string; 
  updatedAt?: string;
}

export interface Space {
  id: string;
  buildingId: string; // Added foreign key
  buildingName: string;
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
  building: Building; // Added relation to Building
}

export interface Tenant {
  id: string;
  name: string;
  email: string;
  phone?: string;
  alternativePhone?: string;
  nationalId?: string;
  representativeName?: string;
  representativePhone?: string;
  rentedSpaceId: string | null;
  createdAt: string; 
  updatedAt?: string;
  rentedSpace?: Space | null; 
  agreements?: Agreement[]; // Added for checking active agreements
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
  endDate?: string | null; // Added for checking active agreements

  tenant?: Tenant | null; // Made optional, as it might not always be included
  space?: Space | null;   // Made optional
  bills?: Bill[]; // For checking associated bills
}

export interface BuildingUtilityItem {
  id?: string; // Optional: useful if managing items individually, but not strictly needed for createMany
  name: string;
  totalCost: number;
  appliesToScope: 'Building' | 'Floor' | 'SpecificSpaces';
  applicableFloor?: string | null; // Made nullable to match Prisma
  applicableSpaceIdNames?: string[] | null; // Made nullable to match Prisma
  monthlyUtilitiesId?: string | null; // Added foreign key
}

export interface BuildingMonthlyUtilities {
  id: string;
  buildingId: string; // Added foreign key
  buildingName: string;
  year: number;
  month: number; // 0-11
  utilities: BuildingUtilityItem[];
  createdAt: string;
  updatedAt?: string; // Added updatedAt
  building?: Building; // Added relation to Building
}

export interface Bill {
  id: string;
  agreementId: string;
  tenantId: string;
  billDate: string;
  dueDate: string;
  rentAmount: number;
  utilityBreakdown: Array<{ name: string; amount: number }>;
  penaltyAmount?: number;
  totalAmount: number;
  status: 'Pending' | 'Paid' | 'Overdue' | 'Pending Verification';
  paymentDate?: string;
  paymentMethod?: string;
  paymentReference?: string;
  bankOrWalletName?: string;
  paymentProofUrl?: string;
  adminVerifiedPayment?: boolean;
  tenantPaymentNotes?: string;
  adminVerificationNotes?: string;
  createdAt?: string; // Added createdAt for recent activity
  updatedAt?: string; // Added updatedAt

  agreement?: Agreement | null; // Relation for tenant/space info
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
