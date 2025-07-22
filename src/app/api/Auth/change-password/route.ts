
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

async function getAuthDetailsFromCookie(): Promise<{accessToken: string; phoneNumber: string; userId: string} | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get('leaseflow_admin_access_token')?.value || cookieStore.get('leaseflow_portal_access_token')?.value;

    if (!token) return null;

    const payload = decodeJwtPayload(token);
    const phoneNumber = payload?.phone_number;
    const userId = payload?.sub;

    if (!phoneNumber || !userId) {
        console.error("Change Password Error: 'phone_number' or 'sub' claim missing from JWT payload for logged-in user.");
        return null;
    }
    
    return { accessToken: token, phoneNumber, userId };
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
    let effectivePhoneNumber: string | undefined = phoneNumberFromRequest;
    let userIdForDbUpdate: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        accessToken = authHeader.substring(7);
        const payload = decodeJwtPayload(accessToken);
        if (payload?.phone_number) {
            effectivePhoneNumber = payload.phone_number;
        }
        if (!effectivePhoneNumber && phoneNumberFromRequest) {
            effectivePhoneNumber = phoneNumberFromRequest;
        }
        userIdForDbUpdate = payload?.sub;
    } else {
        const cookieAuth = await getAuthDetailsFromCookie();
        if (cookieAuth) {
            accessToken = cookieAuth.accessToken;
            effectivePhoneNumber = cookieAuth.phoneNumber;
            userIdForDbUpdate = cookieAuth.userId;
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
