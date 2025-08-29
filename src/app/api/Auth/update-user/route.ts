
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma } from '@prisma/client';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;
const ADMIN_ACCESS_TOKEN_KEY = 'leaseflow_admin_access_token';

// Insecure JWT payload decoder
function decodeJwtPayload(token: string): any | null {
    try {
        const base64Url = token.split('.')[1];
        if (!base64Url) return null;
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error('Failed to decode JWT payload:', e);
        return null;
    }
}

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

    const { userId, firstName, lastName, phoneNumber } = requestBody;

    if (!userId || !firstName || !lastName || !phoneNumber) {
        return NextResponse.json({ isSuccess: false, errors: ["User ID, first name, last name, and phone number are required."] }, { status: 400 });
    }

    const localUserToUpdate = await databaseService.getUserById(userId);
    if (!localUserToUpdate) {
        return NextResponse.json({ isSuccess: false, errors: ["User to update not found in local database."] }, { status: 404 });
    }

    try {
        // Step 1: Update the external identity provider
        const externalResponse = await fetch(`${AUTH_API_BASE_URL}/api/Auth/update-user`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminAccessToken}`,
            },
            body: JSON.stringify({
                currentPhoneNumber: localUserToUpdate.phoneNumber, // The identifier for the user
                newPhoneNumber: phoneNumber,
                firstName: firstName,
                lastName: lastName,
            }),
        });

        if (!externalResponse.ok) {
            const errorData = await externalResponse.json().catch(() => ({ errors: ["Failed to update user on identity server."] }));
            return NextResponse.json({ isSuccess: false, errors: errorData.errors || ["An unknown error occurred on the identity server."] }, { status: externalResponse.status });
        }

        // Step 2: Update the local database
        const updatedLocalUser = await databaseService.updateUser(userId, {
            firstName: firstName,
            lastName: lastName,
            name: `${firstName} ${lastName}`.trim(),
            phoneNumber: phoneNumber,
        });

        // Also update the associated Tenant profile if one exists
        const tenantProfile = await databaseService.findTenantByEmailOrPhone(localUserToUpdate.email, localUserToUpdate.phoneNumber);
        if (tenantProfile) {
            await databaseService.updateTenant(tenantProfile.id, {
                name: `${firstName} ${lastName}`.trim(),
                phone: phoneNumber,
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
