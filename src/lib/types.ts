
export interface Space {
  id: string;
  buildingName: string;
  spaceIdName: string;
  area: number; // sq ft
  floor: string;
  utilityProrationShare: number; // Space's share of total building utilities (e.g., 0.1 for 10%)
  monthlyRentalPrice: number;
  isOccupied: boolean;
  tenantId?: string;
  createdAt: string; // ISO date string
}

export interface Tenant {
  id: string;
  name: string;
  email: string; // For login/portal access
  rentedSpaceId: string | null;
  createdAt: string; // ISO date string
}

export interface Agreement {
  id:string;
  tenantId: string;
  tenantName: string; // Denormalized for easier display
  spaceId: string;
  spaceDescription: string; // Denormalized e.g. "Building A, Unit 101, 500 sqft"
  agreementText: string;
  startDate: string; // ISO date string
  monthlyRentalPrice: number;
  additionalTerms?: string;
  createdAt: string; // ISO date string
  paymentTermMonths: number; // Total term of the agreement in months
  initialPaymentMonths: number; // How many months paid upfront
  nextPaymentDueDate: string; // ISO date string for the next payment
}

export interface BuildingUtilityItem {
  name: string; // e.g., "Electricity", "Water"
  totalCost: number;
}

export interface BuildingMonthlyUtilities {
  id: string; // Unique ID, e.g., "buildingName-YYYY-MM"
  buildingName: string;
  year: number;
  month: number; // 0-11 (for Date object compatibility: 0 for Jan, 1 for Feb, etc.)
  utilities: BuildingUtilityItem[];
  createdAt: string; // ISO date string
}

export interface Bill {
  id: string;
  agreementId: string;
  tenantId: string;
  tenantName: string; // Denormalized
  spaceDescription: string; // Denormalized
  billDate: string; // ISO date string
  dueDate: string; // ISO date string
  rentAmount: number;
  utilityBreakdown: Array<{ name: string; amount: number }>; // Stores prorated amounts for each utility type
  totalAmount: number; // rentAmount + sum of utilityBreakdown amounts
  status: 'Pending' | 'Paid' | 'Overdue';
  paymentDate?: string; // ISO date string
  paymentMethod?: string;
  paymentReference?: string;
  bankOrWalletName?: string; // New field for Bank or Wallet Name
  analysisResult?: string; // From analyzeBill flow
  isAnomalous?: boolean; // From analyzeBill flow
  recommendations?: string; // From analyzeBill flow
}
