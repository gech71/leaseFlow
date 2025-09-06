
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { databaseService } from '@/lib/services/databaseService';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;

// Insecure JWT payload decoder
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

    const { currentPassword, newPassword } = requestBody;

    if (!currentPassword || !newPassword) {
        return NextResponse.json({ isSuccess: false, errors: ["Current and new passwords are required."] }, { status: 400 });
    }

    const authHeader = request.headers.get('Authorization');
    const cookieStore = await cookies();
    const adminToken = cookieStore.get('leaseflow_admin_access_token')?.value;
    const portalToken = cookieStore.get('leaseflow_portal_access_token')?.value;

    let accessToken: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        accessToken = authHeader.substring(7);
    } else if (adminToken) {
        accessToken = adminToken;
    } else if (portalToken) {
        accessToken = portalToken;
    }
    
    if (!accessToken) {
        return NextResponse.json({ isSuccess: false, errors: ["Authentication token is missing."] }, { status: 401 });
    }
    
    const tokenPayload = decodeJwtPayload(accessToken);
    if (!tokenPayload || !tokenPayload.sub) {
        return NextResponse.json({ isSuccess: false, errors: ["Invalid token or user ID not found."] }, { status: 401 });
    }

    const userIdForDbUpdate = tokenPayload.sub;
    const localUser = await databaseService.getUserByExternalId(userIdForDbUpdate);

    if (!localUser || !localUser.phoneNumber) {
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
                phoneNumber: localUser.phoneNumber,
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
                 await databaseService.updateUserByExternalId(userIdForDbUpdate, { tempPassword: null });
                 return NextResponse.json({ isSuccess: true, message: "Password changed successfully." });
             }
             return NextResponse.json({ isSuccess: false, errors: ["Received an invalid response from the authentication service."] }, { status: 500 });
        }

        if (!externalApiResponse.ok) {
            const errorMessages = responseData?.errors || (responseData.message ? [responseData.message] : ["Failed to change password."]);
            return NextResponse.json({ isSuccess: false, errors: errorMessages }, { status: externalApiResponse.status });
        }
        
        await databaseService.updateUserByExternalId(userIdForDbUpdate, { tempPassword: null });

        return NextResponse.json({ isSuccess: true, ...responseData });

    } catch (error) {
        console.error("Change password API call error:", error);
        return NextResponse.json({ isSuccess: false, errors: ["Could not connect to the authentication service."] }, { status: 503 });
    }
}
