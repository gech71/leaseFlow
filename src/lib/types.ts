

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

// --- RBAC Types ---
export interface UserRole {
  id: string;
  name: string;
  permissions: string[];
}

export interface CurrentUser {
  id: string;
  userId: string; // External ID
  email: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber?: string | null;
  roles: UserRole[];
  // Calculated effective permissions from all assigned roles
  effectivePermissions: string[];
}

// Centralized list of available permissions
export const AVAILABLE_PERMISSIONS = [
  { id: 'user:manage', label: 'Manage Users & Registration' },
  { id: 'role:manage', label: 'Manage Roles & Permissions' },
  { id: 'building:manage', label: 'Manage Buildings (Full CUD)' },
  { id: 'building:read', label: 'View Buildings' },
  { id: 'space:manage', label: 'Manage Spaces (Full CUD)' },
  { id: 'space:read', label: 'View Spaces' },
  { id: 'tenant:manage', label: 'Manage Tenants (Full CUD)' },
  { id: 'tenant:read', label: 'View Tenants' },
  { id: 'agreement:manage', label: 'Manage Agreements (Full CUD)' },
  { id: 'agreement:read', label: 'View Agreements' },
  { id: 'billing:manage', label: 'Manage Billing (Generate, Record Payments)' },
  { id: 'billing:read', label: 'View Billing Info' },
  { id: 'building_utilities:manage', label: 'Manage Building Utilities' },
  { id: 'reports:view_all', label: 'View Full Dashboard & All Reports' },
  { id: 'reports:view_financial', label: 'View Financial Reports' },
  { id: 'reports:view_operational', label: 'View Operational Reports' },
  { id: 'settings:manage', label: 'Manage System-wide Settings' }, // General settings permission
] as const;

export type PermissionId = typeof AVAILABLE_PERMISSIONS[number]['id'];
