

import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma } from '@prisma/client';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;
const ADMIN_ACCESS_TOKEN_KEY = 'leaseflow_admin_access_token';

// This API route is kept for potential future direct API integrations but is no longer
// called by the "Edit User" dialog in the admin panel. The logic is now handled
// directly in the `updateUserNamesAction` and `changeUserPhoneNumberAction` server actions.
export async function POST(request: NextRequest) {
    if (!AUTH_API_BASE_URL) {
        console.error("Auth API base URL is not configured.");
        return NextResponse.json({ isSuccess: false, errors: ["Authentication service is not configured."] }, { status: 500 });
    }

    const adminAccessToken = request.cookies.get(ADMIN_ACCESS_TOKEN_KEY)?.value;
    if (!adminAccessToken) {
        return NextResponse.json({ isSuccess: false, errors: ["Admin authentication required."] }, { status: 401 });
    }

    let requestBody;
    try {
        requestBody = await request.json();
    } catch (e) {
        return NextResponse.json({ isSuccess: false, errors: ["Invalid request format."] }, { status: 400 });
    }

    // This endpoint now only handles name updates.
    const { userId, firstName, lastName } = requestBody;

    if (!userId || !firstName || !lastName) {
        return NextResponse.json({ isSuccess: false, errors: ["User ID, first name, and last name are required."] }, { status: 400 });
    }

    const localUserToUpdate = await databaseService.getUserById(userId);
    if (!localUserToUpdate) {
        return NextResponse.json({ isSuccess: false, errors: ["User to update not found in local database."] }, { status: 404 });
    }

    try {
        // Step 1: Update the external identity provider for names
        const externalResponse = await fetch(`${AUTH_API_BASE_URL}/api/Auth/update-user`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminAccessToken}`,
            },
            body: JSON.stringify({
                currentPhoneNumber: localUserToUpdate.phoneNumber, // The identifier for the user
                newPhoneNumber: localUserToUpdate.phoneNumber,   // Keep phone number the same
                firstName: firstName,
                lastName: lastName,
            }),
        });

        if (!externalResponse.ok) {
            const errorData = await externalResponse.json().catch(() => ({ errors: ["Failed to update user name on identity server."] }));
            return NextResponse.json({ isSuccess: false, errors: errorData.errors || ["An unknown error occurred on the identity server."] }, { status: externalResponse.status });
        }

        // Step 2: Update the local database
        const updatedLocalUser = await databaseService.updateUser(userId, {
            firstName: firstName,
            lastName: lastName,
            name: `${firstName} ${lastName}`.trim(),
        });

        // Also update the associated Tenant profile if one exists
        const tenantProfile = await databaseService.findTenantByEmailOrPhone(localUserToUpdate.email, localUserToUpdate.phoneNumber);
        if (tenantProfile) {
            await databaseService.updateTenant(tenantProfile.id, {
                name: `${firstName} ${lastName}`.trim(),
            });
        }
        
        return NextResponse.json({ isSuccess: true, user: updatedLocalUser });

    } catch (error: any) {
        console.error("Update user error:", error);
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            return NextResponse.json({ isSuccess: false, errors: ["A database error occurred while updating the user."] }, { status: 500 });
        }
        return NextResponse.json({ isSuccess: false, errors: ["An unexpected error occurred."] }, { status: 500 });
    }
}
