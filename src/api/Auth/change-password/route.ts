
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;

async function getAccessToken(request: NextRequest): Promise<string | null> {
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }
    const cookieStore = await cookies();
    const adminToken = cookieStore.get('leaseflow_admin_access_token')?.value;
    if (adminToken) return adminToken;
    const portalToken = cookieStore.get('leaseflow_portal_access_token')?.value;
    return portalToken || null;
}

export async function POST(request: NextRequest) {
    if (!AUTH_API_BASE_URL) {
        console.error("Auth API base URL is not configured.");
        return NextResponse.json({ isSuccess: false, errors: ["Authentication service is not configured."] }, { status: 500 });
    }

    const accessToken = await getAccessToken(request);
    if (!accessToken) {
        return NextResponse.json({ isSuccess: false, errors: ["Authentication token is missing."] }, { status: 401 });
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
                'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ currentPassword, newPassword }),
        });

        const responseText = await externalApiResponse.text();
        
        // The external service might return an empty body on success
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

