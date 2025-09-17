
# Low-Level Design: NIB Building Management Solution

## 1. Introduction

This document provides a detailed look at the implementation of key modules within the NIB Building Management Solution, focusing on database schema, component structure, and specific functional logic.

## 2. Database Schema (Prisma)

The core of the application's data is managed through a PostgreSQL database, with Prisma as the ORM.

### Key Models (`prisma/schema.prisma`):

-   **`User`**: Stores local user profile information (name, email, phone) and links to an external `userId`. It has many-to-many relationships with `Role` and `Building` (for managers).
    -   `userId`: The unique identifier (sub) from the external identity provider.
    -   `roles`: Manages permissions.
    -   `managedBuildings`: For property managers, this links them to the buildings they oversee.

-   **`Role`**: Defines a set of permissions.
    -   `name`: Unique name for the role (e.g., `SUPER_ADMIN`, `PROPERTY_MANAGER`).
    -   `permissions`: An array of strings representing specific actions (e.g., `building:create`, `billing:generate`).

-   **`Building`**: Represents a physical building. Contains details like `name`, `address`, and `accountNumber`. It has a one-to-many relationship with `Space`.

-   **`Space`**: Represents a rentable unit within a `Building`.
    -   `spaceIdName`: A human-readable identifier (e.g., "Office 201").
    -   `isOccupied`: A boolean flag to quickly filter for vacant spaces.
    -   `tenantId`: A nullable foreign key establishing a one-to-one relationship with a `Tenant`.

-   **`Tenant`**: Stores information about a lessee.
    -   `userId`: A foreign key linking to the `User` model, enabling portal login.
    -   `rentedSpaceId`: A nullable, unique foreign key for the one-to-one relationship with a `Space`.

-   **`Agreement`**: The central model linking a `Tenant` to a `Space`.
    -   `startDate`, `paymentTermMonths`: Defines the lease duration.
    -   `monthlyRentalPrice`: The base rent amount.
    -   `agreementText`: The full, legally binding text of the agreement.

-   **`Bill`**: Represents a single financial obligation for a tenant.
    -   `status`: An enum (`Pending`, `Paid`, `Overdue`).
    -   `rentAmount`, `utilityBreakdown`, `penaltyAmount`, `totalAmount`: Financial details of the bill.

-   **`DisabledAgreement`**: A crucial model for the "soft deactivation" feature.
    -   A record in this table signifies that a specific administrator (`disabledById`) has deactivated a specific `Agreement` (`agreementId`). This allows for context-specific deactivation without affecting the tenant's status globally.

## 3. Admin Panel - Module Design

### 3.1. Tenant Management (`/admin/tenants`)

-   **Component**: `TenantsClientPage.tsx`
    -   Manages state for the tenant list, filtering, and pagination.
    -   Handles the "Add/Edit Tenant" dialog (`Dialog`) and the "Deactivate" confirmation (`AlertDialog`).
-   **Actions**: `src/app/admin/tenants/actions.ts`
    -   `createTenantAction`: A critical action that encapsulates user registration.
        1.  Checks if a `Tenant` with the given email/phone already exists.
        2.  If not, it checks if a `User` exists.
        3.  If no `User` exists, it generates a temporary password, calls the external identity provider's registration endpoint, and creates a local `User` record.
        4.  Finally, it creates the `Tenant` record and links it to the `User`.
    -   `toggleTenantStatusAction`: Implements the soft-deactivation logic by creating or deleting records in the `DisabledAgreement` table, scoped to the current administrator.

### 3.2. Billing (`/admin/billing`)

-   **Component**: `BillingClientPage.tsx`
    -   Displays two main sections: Bulk Bill Generation and a table of Generated Bills.
    -   Manages complex state for filters (by date, status, search term) and pagination.
    -   Contains the `Dialog` for recording payments.
-   **Actions**: `src/app/admin/billing/actions.ts`
    -   `getBillingPageDataAction`: Fetches all necessary data (agreements, bills, utilities) for the client component.
    -   `generateBillAndUpdateAgreementAction`:
        1.  Calculates rent (handles initial upfront payments).
        2.  Fetches `BuildingMonthlyUtilities` for the period to calculate prorated utility costs.
        3.  Calculates late fees (`calculateIndividualPenalty`) by checking the due date against building-specific `PenaltyTier` policies.
        4.  Creates a new `Bill` record.
        5.  Updates the `Agreement`'s `nextPaymentDueDate`.
    -   `recordPaymentOrVerificationAction`: Updates a bill's status to `Paid` and records payment details.

## 4. Tenant Portal - Module Design

### 4.1. NIB Mini App Connection (`/portal/connect`)

This is the secure entry point from the NIB Super App.

-   **`page.tsx` (Server Component)**:
    1.  Receives the request with an `Authorization: Bearer <token>` header.
    2.  Makes a backend call to `NIB_VALIDATE_TOKEN_URL` to verify the token.
    3.  If successful, it receives the tenant's phone number and renders `ConnectionSuccessPage`.
    4.  If it fails, it renders an error message.
-   **`client-page.tsx` (Client Component)**:
    1.  On render, it immediately calls the `setPortalSessionAction` Server Action.
    2.  `setPortalSessionAction` sets a secure, HttpOnly cookie containing the validated NIB token.
    3.  The component then redirects the user to `/portal/billing`, passing the phone number as a query parameter.

### 4.2. Portal Billing (`/portal/billing`)

-   **`client-page.tsx`**:
    1.  On page load, it uses the phone number from the URL to call `getBillingAmountForPhoneNumberAction` to fetch the outstanding bill amount.
    2.  When the user clicks "Pay Now", it calls `initiatePaymentAction`.
    3.  `initiatePaymentAction` constructs the signed payload (including the SHA256 signature) and sends it to the NIB payment URL.
    4.  Upon receiving a payment token from NIB, it uses `window.myJsChannel.postMessage` to pass this token back to the Super App's native webview for payment completion.

## 5. Security Details

-   **Session Management**: All authenticated sessions (Admin and Portal) are managed via secure, `HttpOnly` cookies. This prevents client-side script access to the session token, mitigating XSS attacks.
-   **Permissions**: The `PermissionProvider` context (`/src/contexts/PermissionContext.tsx`) is a crucial client-side component. It fetches the current user's details and effective permissions from the `/api/user/me` endpoint. The `usePermissions` hook provides an easy way for components to conditionally render UI elements based on the user's permissions (e.g., hiding an "Edit" button).
-   **Encryption**: The `ENCRYPTION_KEY` environment variable is used by the `encryptionService` to encrypt sensitive credentials (like the SMTP App Password) before storing them in the database, ensuring they are never stored in plain text.
-   **Payment Signatures**: Both the payment initiation and callback verification processes rely on SHA256 signatures. The shared secret (`NIB_PAYMENT_KEY`) is never exposed to the client and is used in server-side actions to generate and verify these signatures, ensuring transaction integrity.
