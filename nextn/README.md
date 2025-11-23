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
-   **Authentication**: Custom Server-Side JWTs with HttpOnly cookies
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

# --- Security ---

# Custom JWT Authentication - generate a secret using: `openssl rand -hex 32`
# This key MUST be a 64-character hex string (32 bytes).
JWT_SECRET_KEY=YOUR_64_CHARACTER_JWT_SECRET_KEY_HERE

# Encryption key for sensitive data in the database (e.g., SMTP password).
# This key MUST be a 64-character hex string (32 bytes) for AES-256 encryption.
# Generate one from your terminal using: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=YOUR_64_CHARACTER_ENCRYPTION_KEY_HERE

# --- General ---
# Base URL of this application, used for constructing callback URLs
NEXT_PUBLIC_BASE_URL=http://localhost:3000


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
# The App Password can be set via the Admin UI, but the user and host must be set here.
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_FROM="Your Company Name <your-email@example.com>"

```

### Installation

1.  Clone the repository:
    ```bash
    git clone <your-repository-url>
    cd nibrental
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
    The application will be available at `http://localhost:3000`.

---

## NIB Mini App Payment Integration

This section details the end-to-end process for handling payments initiated from the NIB Bank Super App (Mini App).
*(This section is maintained from the original documentation but is not directly related to the NextAuth.js migration.)*

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
│   │   ├── api/        # API routes (including /api/auth/*)
│   │   ├── portal/     # Tenant portal routes
│   │   └── ...
│   ├── components/     # Reusable UI components (ShadCN and custom)
│   ├── contexts/       # React Context providers (e.g., PermissionContext)
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Core libraries, services, and utilities
│   │   ├── auth/       # Custom authentication logic (JWT, rate limiter)
│   │   ├── services/   # Database service layer
│   │   └── ...
│   └── middleware.ts   # Edge middleware for routing and authentication
└── ...
```
