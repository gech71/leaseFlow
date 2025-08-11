

# LeaseFlow: Building Management Solution

LeaseFlow is a comprehensive, modern web application designed to streamline property management. Built with Next.js, it provides a robust platform for managing buildings, spaces, tenants, and the entire billing lifecycle.

This document provides an overview of the project setup, key features, and a detailed guide to the NIB Bank Mini App payment integration.

## Table of Contents

- [Core Features](#core-features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Setup](#environment-setup)
  - [Installation](#installation)
  - [Running the Application](#running-the-application)
- [NIB Mini App Payment Integration](#nib-mini-app-payment-integration)
  - [Overview](#overview)
  - [Step 1: Initial Connection & Token Validation](#step-1-initial-connection--token-validation)
  - [Step 2: Secure Session Creation](#step-2-secure-session-creation)
  - [Step 3: Fetching Billing Info & Initiating Payment](#step-3-fetching-billing-info--initiating-payment)
  - [Step 4: Payment Initiation with NIB](#step-4-payment-initiation-with-nib)
  - [Step 5: Handling the NIB Payment Callback](#step-5-handling-the-nib-payment-callback)
- [Database](#database)
- [Project Structure](#project-structure)

## Core Features

-   **Multi-tenancy Management**: Manage multiple buildings, each with its own spaces and tenants.
-   **Automated Billing**: Generate monthly bills for rent and prorated utilities.
-   **Lease Agreement Management**: Create and store rental agreements for each tenancy.
-   **Role-Based Access Control (RBAC)**: Fine-grained permission system for different user roles (Super Admin, Property Manager, Accountant, etc.).
-   **Tenant Portal**: A secure portal for tenants to view their bills and payment history.
-   **Secure Payment Integration**: Seamless payment flow integrated with NIB Bank's Mini App.
-   **Email Notifications**: Automated welcome emails with credentials for new users.

## Tech Stack

-   **Framework**: Next.js (App Router)
-   **Language**: TypeScript
-   **Styling**: Tailwind CSS with ShadCN UI components
-   **Database**: PostgreSQL with Prisma ORM
-   **Authentication**: Handled by an external identity provider, with session management via JWTs.
-   **Email**: Nodemailer with Gmail SMTP

## Getting Started

### Prerequisites

-   Node.js (v18 or later)
-   npm or yarn
-   PostgreSQL database
-   Access to NIB Bank's pre-production environment credentials.
-   A Gmail account with an App Password for sending emails.

### Environment Setup

Create a `.env` file in the project root and populate it with the necessary variables.

```env
# Database connection string for Prisma
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"

# Base URL for the external authentication service
NEXT_PUBLIC_AUTH_API_BASE_URL=http://your-auth-service-url

# Base URL of this application, used for constructing callback URLs
NEXT_PUBLIC_BASE_URL=http://localhost:9002

# --- NIB Bank Mini App Integration ---

# Endpoint to validate the initial token from the Mini App
NIB_VALIDATE_TOKEN_URL=http://nib-pre-production.nibbank.com.et:8086/api/Authenticate/GetPhoneByToken

# Endpoint to post the payment initiation request
NIB_PAYMENT_URL=http://nib-pre-production.nibbank.com.et:8086/api/Authenticate/Payment

# Your assigned payment key from NIB
NIB_PAYMENT_KEY=8tq6qqyvuNsBOP5yEQU47N52suWQebaP

# Your merchant account number with NIB
NIB_ACCOUNT_NO=7000101633387

# Your company name as registered with NIB
NIB_COMPANY_NAME=BUILDING

# --- Nodemailer SMTP Configuration ---
# For Gmail, use smtp.gmail.com and port 587.
# IMPORTANT: You must generate an "App Password" for your Google Account.
# See: https://support.google.com/accounts/answer/185833
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-gmail-app-password"
SMTP_FROM="Your Company Name <your-email@gmail.com>"

```

### Installation

1.  Clone the repository:
    ```bash
    git clone <your-repository-url>
    cd leaseflow
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

### Running the Application

1.  **Generate Prisma Client**:
    ```bash
    npx prisma generate
    ```

2.  **Run Database Migrations**:
    ```bash
    npx prisma migrate dev
    ```

3.  **Seed the Database**:
    ```bash
    npm run prisma:seed
    ```
    *Note: You may need to update the default user ID in `prisma/seed.ts` to match the `sub` claim from your authentication provider's JWT.*

4.  **Start the Development Server**:
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:9002`.

---

## NIB Mini App Payment Integration

This section details the end-to-end process for handling payments initiated from the NIB Bank Super App (Mini App).

### Overview

The flow is designed to be secure and robust, ensuring that payment requests are authentic and that transaction statuses are reliably updated.

```mermaid
sequenceDiagram
    participant MiniApp as NIB Super App
    participant LeaseFlow as LeaseFlow App
    participant NIB as NIB Server

    MiniApp->>+LeaseFlow: 1. Opens /portal/connect with Auth Header
    LeaseFlow->>+NIB: 2. Validates token
    NIB-->>-LeaseFlow: 3. Returns phone number
    LeaseFlow-->>-MiniApp: 4. Sets session cookie & redirects to /portal/billing
    MiniApp->>+LeaseFlow: 5. User clicks "Pay Now"
    LeaseFlow->>LeaseFlow: 6. Generates signed payload
    LeaseFlow->>+NIB: 7. Initiates payment with signed payload
    NIB-->>-LeaseFlow: 8. Returns payment token
    LeaseFlow-->>-MiniApp: 9. Sends token back to MiniApp via JS channel
    Note over MiniApp: User completes payment
    NIB->>+LeaseFlow: 10. Sends POST to callback URL with transaction details & signature
    LeaseFlow->>LeaseFlow: 11. Validates signature
    LeaseFlow->>LeaseFlow: 12. Updates bill status to "Paid"
    LeaseFlow-->>-NIB: 13. Responds with HTTP 200 OK
```

### Step 1: Initial Connection & Token Validation

When a user enters the Mini App, NIB opens the application at the `/portal/connect` endpoint.

-   **Route**: `GET /portal/connect`
-   **Process**:
    1.  The request must contain an `Authorization: Bearer <token>` header provided by the NIB Super App.
    2.  The LeaseFlow server extracts this token.
    3.  It makes a backend `GET` request to the `NIB_VALIDATE_TOKEN_URL` to verify the token's authenticity.
    4.  If valid, the NIB server responds with the user's phone number. If invalid, an error is shown.
-   **File**: `src/app/portal/connect/page.tsx`

### Step 2: Secure Session Creation

To maintain the user's authenticated state for subsequent actions without continuously passing the token, a secure session is created.

-   **Process**:
    1.  Upon successful token validation in Step 1, the `/portal/connect` page renders a client component (`ConnectionSuccessPage`).
    2.  This component immediately calls a Server Action (`setPortalSessionAction`).
    3.  The Server Action sets a secure, `HttpOnly` cookie named `leaseflow_portal_access_token` containing the validated token.
    4.  The user is then automatically redirected to `/portal/billing`.
-   **Files**:
    -   `src/app/portal/connect/client-page.tsx` (Calls the action)
    -   `src/app/portal/actions.ts` (Defines `setPortalSessionAction`)

### Step 3: Fetching Billing Info & Initiating Payment

The user is now on the billing page, authenticated via their session cookie.

-   **Route**: `GET /portal/billing`
-   **Process**:
    1.  The page uses the phone number (passed as a URL query parameter from Step 1) to fetch the tenant's outstanding bill from the database via a Server Action (`getBillingAmountForPhoneNumberAction`).
    2.  The outstanding amount is displayed to the user.
    3.  The user clicks the "Pay Now" button to proceed.
-   **Files**:
    -   `src/app/portal/billing/page.tsx`
    -   `src/app/portal/billing/client-page.tsx`
    -   `src/app/portal/billing/actions.ts`

### Step 4: Payment Initiation with NIB

This is a critical server-side step where the payment request is securely constructed and sent to NIB.

-   **Process**:
    1.  The "Pay Now" button triggers the `initiatePaymentAction` Server Action.
    2.  This action reads the session token from the `HttpOnly` cookie.
    3.  It generates a unique `transactionId` using `crypto.randomUUID()` and a `transactionTime`.
    4.  A **signature** is generated by creating a SHA256 hash of a concatenated string of parameters in a specific, fixed order. The secret `NIB_PAYMENT_KEY` is included in this string.
        ```typescript
        // From: src/app/portal/billing/actions.ts
        const signatureString = [
            `accountNo=${ACCOUNT_NO}`,
            `amount=300`,
            `callBackURL=${CALLBACK_URL}`,
            `companyName=${COMPANY_NAME}`,
            `Key=${NIB_PAYMENT_KEY}`,
            `token=${token}`,
            `transactionId=${transactionId}`,
            `transactionTime=${transactionTime}`
        ].join('&');
        
        const signature = crypto.createHash('sha256').update(signatureString, 'utf8').digest('hex');
        ```
    5.  The bill record in the database is updated to `PendingVerification`, and the generated `transactionId` and `signature` are stored for later validation.
    6.  A `POST` request containing the full payload (including the signature) is sent to the `NIB_PAYMENT_URL`.
    7.  If successful, the NIB server responds with data, including a new `token` for the payment session.
    8.  This payment token is sent back to the client, which then uses `window.myJsChannel.postMessage` to pass it back to the NIB Super App, allowing the user to complete the payment.
-   **File**: `src/app/portal/billing/actions.ts`

### Step 5: Handling the NIB Payment Callback

Once the user completes the payment, the NIB server sends a notification to our backend.

-   **Route**: `POST /api/portal/payment-callback`
-   **Process**:
    1.  **Token Validation**: The handler first validates the `Authorization` header token sent by NIB to ensure the request is legitimate.
    2.  **Payload Reception**: It parses the JSON body containing transaction details (`paidAmount`, `txnRef`, `transactionId`, `signature`, etc.).
    3.  **Signature Verification**:
        -   It uses the `transactionId` from the payload to find the original bill record in the database.
        -   It retrieves the `signature` that was stored in the database during Step 4.
        -   It compares the stored signature with the `signature` received in the callback payload. They must match exactly.
    4.  **Database Update**: If the signatures match, the bill's status is updated to **Paid**. The final `txnRef` from NIB is saved as the payment reference.
    5.  **Response**: The server responds with `HTTP 200 OK` to acknowledge successful receipt. If validation fails at any point, an appropriate error code (400 or 401) is returned.
-   **File**: `src/app/api/portal/payment-callback/route.ts`

## Database

The application uses a PostgreSQL database, managed with the Prisma ORM. The schema is defined in `prisma/schema.prisma`.

-   To apply schema changes: `npx prisma migrate dev`
-   To generate the Prisma client: `npx prisma generate`

## Project Structure

A brief overview of the key directories:

```
/
├── prisma/             # Database schema, migrations, and seed script
├── public/             # Static assets
├── src/
│   ├── app/            # Next.js App Router (pages and layouts)
│   │   ├── admin/      # Admin panel routes
│   │   ├── api/        # API routes
│   │   ├── portal/     # Tenant portal routes
│   │   └── ...
│   ├── components/     # Reusable UI components (ShadCN and custom)
│   ├── contexts/       # React Context providers (e.g., permissions)
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Core libraries, services, and utilities
│   │   ├── services/   # Database service layer
│   │   └── ...
│   └── middleware.ts   # Edge middleware for routing and authentication
└── ...
```
    