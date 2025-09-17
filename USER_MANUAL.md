
# User Manual: NIB Building Management Solution

## 1. Introduction

Welcome to the NIB Building Management Solution! This guide provides instructions for administrators and property managers on how to use the Admin Panel to manage your properties, tenants, and finances effectively.

## 2. Getting Started: First Login

Upon your first login, you will be directed to the Admin Dashboard. If this is a new system, many sections will be empty. The recommended first steps are:

1.  **Configure Settings**: Navigate to the Settings area to set up essential configurations.
2.  **Add Buildings**: Register the properties you manage.
3.  **Add Spaces**: Define the rentable units within your buildings.
4.  **Add Tenants**: Onboard your tenants into the system.
5.  **Create Agreements**: Link tenants to spaces with a formal agreement.

## 3. Core Modules

### 3.1. Dashboard

The dashboard provides a high-level overview of your entire operation, including:
-   Total number of buildings, spaces, and active tenants.
-   Occupancy rates.
-   A financial snapshot of revenue and expenses for the selected period.
-   Recent activities across the system.

### 3.2. Buildings

-   **To Add a Building**:
    1.  Navigate to **Buildings** from the sidebar.
    2.  Click the "Add New Building" button.
    3.  Fill in the building's name, address, and the associated NIB bank account number.
    4.  Define late fee policies. You can add multiple rules based on how many days a payment is overdue.
    5.  Click "Add Building".

### 3.3. Spaces

-   **To Add a Space**:
    1.  Navigate to **Spaces** from the sidebar.
    2.  Click the "Add New Space" button.
    3.  Select the building this space belongs to.
    4.  Enter the details for the space, including a unique `Space ID/Name` (e.g., "Suite 404"), floor, area, and default monthly rent.
    5.  Enter the `Proration Share %`. This percentage determines how much of the building's total shared utility costs will be assigned to this space.
    6.  Click "Add Space".

### 3.4. Tenants

-   **To Add a New Tenant**:
    1.  Navigate to **Tenants** from the sidebar.
    2.  Click the "Add New Tenant" button.
    3.  **Important**: First, try searching for an existing user by phone number. If the user already has an account, their details will be pre-filled.
    4.  If the user is new, fill in their full name, email, phone number, and National ID.
    5.  Click "Add Tenant".
    6.  The system will automatically create a user account for the tenant and email them a welcome message with their login credentials (phone number and a temporary password).
    7.  The temporary password will be briefly visible on the user management page for you to share with the tenant if needed.

-   **To Deactivate a Tenant**:
    1.  On the tenant's card, click the status toggle button (the icon showing a person with an 'X').
    2.  Confirm the action. This will make all agreements for this tenant within your managed buildings inactive. The tenant will no longer see these agreements in their portal.
    3.  This does **not** delete the tenant. You can reactivate them at any time.

### 3.5. Agreements

-   **To Create an Agreement**:
    1.  Navigate to **Agreements** from the sidebar.
    2.  Click "Create New Agreement".
    3.  Select a `Tenant` from the dropdown list.
    4.  Select a vacant `Space`. The monthly rent will auto-fill from the space's details.
    5.  Choose an `Agreement Template`.
    6.  Set the `Start Date`, total `Term (Months)`, and `Initial Payment (Months)` (i.e., how many months' rent are being paid upfront).
    7.  Click "Preview Agreement" to see the generated text.
    8.  If everything is correct, click "Finalize & Save Agreement". This will occupy the space and create an initial bill.

### 3.6. Building Utilities

-   **To Enter Monthly Costs**:
    1.  Navigate to **Building Utilities**.
    2.  Select the `Building` and the `Month/Year` for which you are entering costs.
    3.  Click "Add Item" for each utility type (e.g., Electricity, Water).
    4.  For each item, specify the `Scope`:
        -   **Entire Building**: The `Total Cost` will be prorated among all spaces based on their proration share.
        -   **Specific Floor/Spaces**: The `Total Cost` will be allocated based on percentages you define for each space on that floor or within the building.
    5.  Click "Save Utilities". This data will be used when generating the next batch of bills.

### 3.7. Billing

-   **To Generate Bills**:
    1.  Navigate to **Billing**.
    2.  Click the "Generate All Due Bills" button. The system will find all agreements due for a bill, calculate rent, utilities, and penalties, and create the bills.
    3.  Alternatively, you can find a specific agreement in the "Individual Bill Generation" section and generate a bill for it.
-   **To Record a Manual Payment**:
    1.  Find the bill in the "Generated Bills" table.
    2.  Click the "Record Payment" button (credit card icon).
    3.  Fill in the payment date, method, and any reference number.
    4.  Click "Record as Paid".

## 4. Settings

### 4.1. User Registration

-   Use this page to create new **non-tenant** user accounts (e.g., for new staff members).
-   Newly registered users have no roles by default and must be assigned one in User Management.

### 4.2. User Management

-   This is where you assign roles and building management responsibilities to users.
-   Click the "Edit Assignments" button for a user.
-   **Assign Role**: Select a single role for the user from the dropdown. To give a user management capabilities, they must have a role with the relevant permissions (e.g., `PROPERTY_MANAGER`).
-   **Assign Managed Buildings**: If the user is a manager, select the buildings they are responsible for. Non-super-admins can only assign buildings from their own managed list.

### 4.3. Role Management

-   Create custom roles for your staff.
-   When creating a role, give it an `UPPERCASE_WITH_UNDERSCORES` name (e.g., `JUNIOR_ACCOUNTANT`).
-   Expand the permission categories and select the specific actions users with this role are allowed to perform.
