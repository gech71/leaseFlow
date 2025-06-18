
export interface PenaltyTier {
  fromDay: number;
  toDay?: number | null; // null means it's the last, ongoing tier in its sequence for the scope
  feeType: 'Fixed' | 'Percentage';
  feeValue: number;
  // Scope fields
  scope: 'Building' | 'Floor' | 'SpecificSpaces';
  applicableFloor?: string; // Used if scope is 'Floor'
  applicableSpaceIdNames?: string[]; // Used if scope is 'SpecificSpaces', stores Space.spaceIdName
}

export interface Building {
  id: string;
  name: string;
  address?: string;
  penaltyPolicyTiers?: PenaltyTier[]; // A flat list of all tiers, each with its scope
  createdAt: string; // ISO date string
}

export interface Space {
  id: string;
  buildingName: string;
  spaceIdName: string; // Unique identifier for the space within the building, e.g., "Unit 10A", "Office 201"
  area: number; // sq ft
  floor: string; // e.g., "1st", "Ground", "10"
  utilityProrationShare: number; // Space's share of *building-wide* utilities (e.g., 0.1 for 10%)
  monthlyRentalPrice: number;
  isOccupied: boolean;
  tenantId?: string;
  createdAt: string; // ISO date string
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
  createdAt: string; // ISO date string
}

export interface Agreement {
  id:string;
  tenantId: string;
  tenantName: string;
  spaceId: string;
  spaceDescription: string;
  agreementText: string;
  startDate: string;
  monthlyRentalPrice: number;
  additionalTerms?: string;
  createdAt: string;
  paymentTermMonths: number;
  initialPaymentMonths: number;
  nextPaymentDueDate: string;

  initialPaymentAmount?: number;
  initialPaymentMethod?: string;
  initialPaymentReference?: string;
  initialPaymentBankOrWalletName?: string;
  initialPaymentDate?: string;
}

export interface BuildingUtilityItem {
  name: string;
  totalCost: number;
  appliesToScope: 'Building' | 'Floor' | 'SpecificSpaces';
  applicableFloor?: string;
  applicableSpaceIdNames?: string[];
}

export interface BuildingMonthlyUtilities {
  id: string;
  buildingName: string;
  year: number;
  month: number;
  utilities: BuildingUtilityItem[];
  createdAt: string;
}

export interface Bill {
  id: string;
  agreementId: string;
  tenantId: string;
  spaceDescription: string;
  billDate: string;
  dueDate: string;
  rentAmount: number;
  utilityBreakdown: Array<{ name: string; amount: number }>;
  penaltyAmount?: number;
  totalAmount: number;
  status: 'Pending' | 'Paid' | 'Overdue' | 'Pending Verification'; // Added 'Pending Verification'
  paymentDate?: string;
  paymentMethod?: string;
  paymentReference?: string;
  bankOrWalletName?: string;
  paymentProofUrl?: string; // For tenant uploaded proof
  adminVerifiedPayment?: boolean; // Flag for admin confirmation
  tenantPaymentNotes?: string; // Notes from tenant during proof submission
  adminVerificationNotes?: string; // Notes from admin during verification
}

