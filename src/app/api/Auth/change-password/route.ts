
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { databaseService } from '@/lib/services/databaseService';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;

function decodeJwtPayload(token: string): any | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Failed to decode JWT payload:', e);
    return null;
  }
}

// Updated helper to get user details from the database using the token's user ID
async function getAuthDetailsFromSession(): Promise<{accessToken: string; phoneNumber: string; userId: string} | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get('leaseflow_admin_access_token')?.value || cookieStore.get('leaseflow_portal_access_token')?.value;

    if (!token) {
        console.error("Change Password Error: No session token found.");
        return null;
    }

    const payload = decodeJwtPayload(token);
    const userId = payload?.sub;

    if (!userId) {
        console.error("Change Password Error: 'sub' claim missing from JWT payload for logged-in user.");
        return null;
    }

    // Fetch user from local DB to get their phone number
    const localUser = await databaseService.getUserByExternalId(userId);
    if (!localUser || !localUser.phoneNumber) {
        console.error(`Change Password Error: User with ID ${userId} not found in local DB or has no phone number.`);
        return null;
    }
    
    return { accessToken: token, phoneNumber: localUser.phoneNumber, userId: userId };
}


export async function POST(request: NextRequest) {
    if (!AUTH_API_BASE_URL) {
        console.error("Auth API base URL is not configured.");
        return NextResponse.json({ isSuccess: false, errors: ["Authentication service is not configured."] }, { status: 500 });
    }

    let requestBody;
    try {
        requestBody = await request.json();
    } catch (e) {
        return NextResponse.json({ isSuccess: false, errors: ["Invalid request format."] }, { status: 400 });
    }
    
    const { currentPassword, newPassword, phoneNumber: phoneNumberFromRequest } = requestBody;

    if (!currentPassword || !newPassword) {
        return NextResponse.json({ isSuccess: false, errors: ["Current and new passwords are required."] }, { status: 400 });
    }

    // Determine the source of authentication details
    const authHeader = request.headers.get('Authorization');
    let accessToken: string | undefined;
    let effectivePhoneNumber: string | undefined;
    let userIdForDbUpdate: string | undefined;

    // This handles the post-login "force change password" flow where the token is sent as a header
    if (authHeader && authHeader.startsWith('Bearer ')) {
        accessToken = authHeader.substring(7);
        // In this specific flow, the phone number must be provided in the body
        effectivePhoneNumber = phoneNumberFromRequest;
        const payload = decodeJwtPayload(accessToken);
        userIdForDbUpdate = payload?.sub;
    } else {
        // This handles a logged-in user changing their password from their profile page
        const sessionAuth = await getAuthDetailsFromSession();
        if (sessionAuth) {
            accessToken = sessionAuth.accessToken;
            effectivePhoneNumber = sessionAuth.phoneNumber;
            userIdForDbUpdate = sessionAuth.userId;
        }
    }

    if (!accessToken) {
        return NextResponse.json({ isSuccess: false, errors: ["Authentication token is missing."] }, { status: 401 });
    }
    if (!effectivePhoneNumber) {
        return NextResponse.json({ isSuccess: false, errors: ["User phone number could not be determined."] }, { status: 400 });
    }

    try {
        const externalApiResponse = await fetch(`${AUTH_API_BASE_URL}/api/Auth/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ 
                phoneNumber: effectivePhoneNumber,
                currentPassword: currentPassword, 
                newPassword: newPassword 
            }),
        });

        const responseText = await externalApiResponse.text();
        
        let responseData;
        try {
            responseData = responseText ? JSON.parse(responseText) : {};
        } catch(e) {
             if (externalApiResponse.ok && !responseText) {
                 if (userIdForDbUpdate) {
                    await databaseService.updateUserByExternalId(userIdForDbUpdate, { tempPassword: null });
                 }
                 return NextResponse.json({ isSuccess: true, message: "Password changed successfully." });
             }
             return NextResponse.json({ isSuccess: false, errors: ["Received an invalid response from the authentication service."] }, { status: 500 });
        }

        if (!externalApiResponse.ok) {
            const errorMessages = responseData?.errors || (responseData.message ? [responseData.message] : ["Failed to change password."]);
            return NextResponse.json({ isSuccess: false, errors: errorMessages }, { status: externalApiResponse.status });
        }
        
        if (userIdForDbUpdate) {
            await databaseService.updateUserByExternalId(userIdForDbUpdate, { tempPassword: null });
        }

        return NextResponse.json({ isSuccess: true, ...responseData });

    } catch (error) {
        console.error("Change password API call error:", error);
        return NextResponse.json({ isSuccess: false, errors: ["Could not connect to the authentication service."] }, { status: 503 });
    }
}
