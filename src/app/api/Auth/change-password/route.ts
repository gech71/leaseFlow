
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';

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

async function getAccessTokenAndPhone(request: NextRequest): Promise<{accessToken: string; phoneNumber: string} | null> {
    const authHeader = request.headers.get('Authorization');
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    } else {
        const cookieStore = await cookies();
        token = cookieStore.get('leaseflow_admin_access_token')?.value || cookieStore.get('leaseflow_portal_access_token')?.value;
    }

    if (!token) return null;

    const payload = decodeJwtPayload(token);
    // The phone number claim in the JWT from your identity provider is "phone_number"
    const phoneNumber = payload?.phone_number;

    if (!phoneNumber) {
        console.error("Change Password Error: 'phone_number' claim missing from JWT payload.");
        return null;
    }
    
    return { accessToken: token, phoneNumber };
}

export async function POST(request: NextRequest) {
    if (!AUTH_API_BASE_URL) {
        console.error("Auth API base URL is not configured.");
        return NextResponse.json({ isSuccess: false, errors: ["Authentication service is not configured."] }, { status: 500 });
    }

    const authDetails = await getAccessTokenAndPhone(request);
    if (!authDetails) {
        return NextResponse.json({ isSuccess: false, errors: ["Authentication token is missing or invalid."] }, { status: 401 });
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

    try {
        const externalApiResponse = await fetch(`${AUTH_API_BASE_URL}/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authDetails.accessToken}`,
            },
            body: JSON.stringify({ 
                phoneNumber: authDetails.phoneNumber,
                currentPassword: currentPassword, 
                newPassword: newPassword 
            }),
        });

        const responseText = await externalApiResponse.text();
        
        if (externalApiResponse.ok && !responseText) {
            return NextResponse.json({ isSuccess: true, message: "Password changed successfully." });
        }
        
        let responseData;
        try {
            responseData = responseText ? JSON.parse(responseText) : {};
        } catch(e) {
             console.error("Change Password Error: Failed to parse JSON response from identity server.", responseText);
             return NextResponse.json({ isSuccess: false, errors: ["Received an invalid response from the authentication service."] }, { status: 500 });
        }

        if (!externalApiResponse.ok) {
            const errorMessages = responseData?.errors || (responseData.message ? [responseData.message] : ["Failed to change password."]);
            return NextResponse.json({ isSuccess: false, errors: errorMessages }, { status: externalApiResponse.status });
        }

        return NextResponse.json({ isSuccess: true, ...responseData });

    } catch (error) {
        console.error("Change password API call error:", error);
        return NextResponse.json({ isSuccess: false, errors: ["Could not connect to the authentication service."] }, { status: 503 });
    }
}
