
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
        const externalApiResponse = await fetch(`${AUTH_API_BASE_URL}/api/Auth/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ currentPassword, newPassword }),
        });

        const responseText = await externalApiResponse.text();
        
        // The external service might return an empty body on success (200 OK)
        if (externalApiResponse.ok) {
          if (!responseText) {
            return NextResponse.json({ isSuccess: true, message: "Password changed successfully." });
          }
          // If body is not empty, try to parse it
          try {
            const responseData = JSON.parse(responseText);
            return NextResponse.json({ isSuccess: true, ...responseData });
          } catch (e) {
             // If parsing fails but status is OK, treat as success
             return NextResponse.json({ isSuccess: true, message: "Password changed successfully (unreadable response)." });
          }
        }

        // Handle error responses
        let errorMessages = ["Failed to change password."];
        if (responseText) {
            try {
                const errorData = JSON.parse(responseText);
                errorMessages = errorData?.errors || errorData?.message ? [errorData.message] : errorMessages;
            } catch (e) {
                // The error response wasn't valid JSON, use the raw text if short
                if (responseText.length < 200) {
                    errorMessages = [responseText];
                }
            }
        }

        return NextResponse.json({ isSuccess: false, errors: errorMessages }, { status: externalApiResponse.status });

    } catch (error) {
        console.error("Change password API call error:", error);
        return NextResponse.json({ isSuccess: false, errors: ["Could not connect to the authentication service."] }, { status: 503 });
    }
}
