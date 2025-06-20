
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

// Defines actions for a resource
export const PERMISSION_ACTIONS = ['view', 'create', 'edit', 'delete'] as const;
export type PermissionAction = typeof PERMISSION_ACTIONS[number];

// Defines a single permission
export interface PermissionItem {
  id: string; // e.g., "building:view"
  label: string; // e.g., "View"
}

// Defines a resource and its associated permissions
export interface ResourcePermissionGroup {
  resourceId: string; // e.g., "building"
  resourceLabel: string; // e.g., "Buildings"
  permissions: PermissionItem[]; // Array of specific permissions for this resource
}

// New structured permissions list
export const ALL_RESOURCE_PERMISSIONS: ResourcePermissionGroup[] = [
  {
    resourceId: 'dashboard',
    resourceLabel: 'Dashboard',
    permissions: [{ id: 'dashboard:view', label: 'View' }],
  },
  {
    resourceId: 'building',
    resourceLabel: 'Buildings',
    permissions: [
      { id: 'building:view', label: 'View' },
      { id: 'building:create', label: 'Create' },
      { id: 'building:edit', label: 'Edit' },
      { id: 'building:delete', label: 'Delete' },
    ],
  },
  {
    resourceId: 'space',
    resourceLabel: 'Spaces',
    permissions: [
      { id: 'space:view', label: 'View' },
      { id: 'space:create', label: 'Create' },
      { id: 'space:edit', label: 'Edit' },
      { id: 'space:delete', label: 'Delete' },
    ],
  },
  {
    resourceId: 'tenant',
    resourceLabel: 'Tenants',
    permissions: [
      { id: 'tenant:view', label: 'View' },
      { id: 'tenant:create', label: 'Create' },
      { id: 'tenant:edit', label: 'Edit' },
      { id: 'tenant:delete', label: 'Delete' },
    ],
  },
  {
    resourceId: 'agreement',
    resourceLabel: 'Agreements',
    permissions: [
      { id: 'agreement:view', label: 'View' },
      { id: 'agreement:create', label: 'Create' },
      { id: 'agreement:edit', label: 'Edit' }, 
      { id: 'agreement:delete', label: 'Delete' },
    ],
  },
  {
    resourceId: 'building_utility',
    resourceLabel: 'Building Utilities',
    permissions: [
      { id: 'building_utility:view', label: 'View' },
      { id: 'building_utility:manage', label: 'Manage (CUD)' },
    ],
  },
  {
    resourceId: 'billing',
    resourceLabel: 'Billing',
    permissions: [
      { id: 'billing:view', label: 'View' },
      { id: 'billing:generate', label: 'Generate Bills' },
      { id: 'billing:manage_payments', label: 'Record/Verify Payments' },
      { id: 'billing:delete', label: 'Delete Bills' },
    ],
  },
  {
    resourceId: 'payment_overview',
    resourceLabel: 'Payments Overview',
    permissions: [
      { id: 'payment_overview:view', label: 'View' },
    ],
  },
  {
    resourceId: 'settings',
    resourceLabel: 'Settings Area', 
    permissions: [
      { id: 'settings:user_registration:manage', label: 'Register New Users' },
      { id: 'settings:user_management:view', label: 'View User Assignments' },
      { id: 'settings:user_management:assign', label: 'Assign Roles/Buildings' },
      { id: 'settings:role_management:view', label: 'View Roles' },
      { id: 'settings:role_management:manage', label: 'Manage Roles (CUD)' },
    ],
  },
];

// Flattened list for convenience, though direct iteration over structured list is often better.
export const AVAILABLE_PERMISSIONS: PermissionItem[] = ALL_RESOURCE_PERMISSIONS.flatMap(group => group.permissions);
export type PermissionId = typeof AVAILABLE_PERMISSIONS[number]['id'];

// Old list - to be deprecated/removed after refactor
export const OLD_AVAILABLE_PERMISSIONS = [
  { id: 'user:manage', label: 'Manage Users & Registration' },
  { id: 'role:manage', label: 'Manage Roles & Permissions' },
  // ... other old permissions
] as const;

    
