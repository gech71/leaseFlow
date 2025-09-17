
# System Requirements: NIB Building Management Solution

## 1. Introduction

This document outlines the functional and non-functional requirements for the NIB Building Management Solution. These requirements define the system's capabilities, constraints, and quality attributes.

## 2. Functional Requirements

### FR-01: User Management
-   **FR-01.1**: The system shall allow Super Admins to register new users with an email, phone number, and password.
-   **FR-01.2**: The system shall allow Super Admins and authorized managers to assign roles to users.
-   **FR-01.3**: The system shall allow Super Admins to assign users as managers of one or more buildings.
-   **FR-01.4**: Users must be able to change their own passwords.
-   **FR-01.5**: Super Admins must be able to initiate a password reset process for any user.

### FR-02: Role & Permission Management
-   **FR-02.1**: The system shall have a default `SUPER_ADMIN` role with all permissions.
-   **FR-02.2**: The system shall have a default `TENANT` role with portal-only access.
-   **FR-02.3**: Super Admins shall be able to create, edit, and delete custom roles.
-   **FR-02.4**: When creating or editing a role, an admin must be able to assign specific permissions from a predefined list (e.g., `building:create`, `tenant:view`).

### FR-03: Building & Space Management
-   **FR-03.1**: Authorized users must be able to create, edit, and view buildings with details such as name, address, and bank account number.
-   **FR-03.2**: Authorized users must be able to create, edit, and view spaces within a building, including details like Space ID, floor, area (m²), and monthly rent.
-   **FR-03.3**: The system must prevent the deletion of a building if it has associated spaces.

### FR-04: Tenant Management
-   **FR-04.1**: Authorized users must be able to create new tenant profiles, which also creates a corresponding user account for the tenant portal.
-   **FR-04.2**: The system must automatically send a welcome email with login credentials to newly created tenants.
-   **FR-04.3**: The system shall allow authorized users to activate and deactivate tenants. Deactivation must only apply within the context of the acting administrator's managed buildings.
-   **FR-04.4**: An inactive tenant must be prevented from logging into the tenant portal.

### FR-05: Agreement Management
-   **FR-05.1**: Authorized users must be able to generate a new rental agreement by linking a tenant to a vacant space.
-   **FR-05.2**: The system shall support agreement templates with placeholders (e.g., `{{tenantName}}`, `{{monthlyRent}}`) to standardize agreement generation.
-   **FR-05.3**: The system must create an initial bill for any upfront payment (e.g., first month's rent) when an agreement is created.
-   **FR-05.4**: The system must mark the selected space as "Occupied" upon agreement creation.

### FR-06: Billing & Payments
-   **FR-06.1**: The system must allow authorized users to input monthly utility costs (e.g., water, electricity) for an entire building.
-   **FR-06.2**: The system must provide a mechanism to generate monthly bills for all active tenants.
-   **FR-06.3**: Generated bills must include base rent and prorated utility costs based on the space's `utilityProrationShare`.
-   **FR-06.4**: The system must automatically calculate and add late fees to overdue bills based on configurable penalty policies for each building.
-   **FR-06.5**: Authorized users must be able to manually record payments (Cash, Check, etc.).
-   **FR-06.6**: The system must integrate with the NIB Bank Mini App for tenant-initiated payments.

### FR-07: Tenant Portal
-   **FR-07.1**: Tenants must be able to log in to a secure portal using their phone number and password.
-   **FR-07.2**: Tenants must be required to change their temporary password on first login.
-   **FR-07.3**: The portal shall display a list of all current and past bills for the tenant.
-   **FR-07.4**: The portal must show a clear breakdown of each bill, including rent, utilities, and penalties.
-   **FR-07.5**: Tenants must be able to view their complete payment history.

## 3. Non-Functional Requirements

### NFR-01: Performance
-   **NFR-01.1**: All admin panel pages must load in under 3 seconds on a standard broadband connection.
-   **NFR-01.2**: Database queries must be optimized to handle at least 1,000 buildings and 50,000 tenants without significant performance degradation.

### NFR-02: Security
-   **NFR-02.1**: All user passwords must be managed and stored by the external identity provider, not in the application's database.
-   **NFR-02.2**: Session tokens must be stored in secure, `HttpOnly` cookies.
-   **NFR-02.3**: Sensitive credentials (e.g., SMTP password) stored in the database must be encrypted using AES-256.
-   **NFR-02.4**: The application must enforce role-based access control on all server-side actions and API endpoints.
-   **NFR-02.5**: All payment integration communication must be signed and verified using SHA256 hashes.

### NFR-03: Usability
-   **NFR-03.1**: The user interface must be responsive and functional on modern web browsers on both desktop and mobile devices.
-   **NFR-03.2**: The application must provide clear feedback to users for all actions (e.g., success messages, validation errors).

### NFR-04: Reliability
-   **NFR-04.1**: The system should aim for 99.9% uptime.
-   **NFR-04.2**: The application must handle external service failures (e.g., NIB API, SMTP server) gracefully and provide informative error messages to the user.

### NFR-05: Maintainability
-   **NFR-05.1**: The codebase must be written in TypeScript and follow consistent coding standards.
-   **NFR-05.2**: The codebase should be well-organized, with a clear separation between UI components, server actions, and database services.
