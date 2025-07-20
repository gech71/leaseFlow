
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { databaseService } from '@/lib/services/databaseService';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;
const ADMIN_ACCESS_TOKEN_KEY = 'leaseflow_admin_access_token';
const PORTAL_ACCESS_TOKEN_KEY = 'leaseflow_portal_access_token';

// Insecure JWT payload decoder for prototype purposes ONLY.
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
    return NextResponse.json({ isSuccess: false, errors: ["Authentication service is not configured."] }, { status: 500 });
  }

  const cookieStore = await cookies();
  const adminToken = cookieStore.get(ADMIN_ACCESS_TOKEN_KEY)?.value;
  const portalToken = cookieStore.get(PORTAL_ACCESS_TOKEN_KEY)?.value;

  const accessToken = adminToken || portalToken;

  if (!accessToken) {
    return NextResponse.json({ isSuccess: false, errors: ["Authentication required."] }, { status: 401 });
  }

  // Decode the token to get the user's phone number securely
  const tokenPayload = decodeJwtPayload(accessToken);
  if (!tokenPayload) {
    return NextResponse.json({ isSuccess: false, errors: ["Invalid authentication token."] }, { status: 401 });
  }
  
  // The phone number is typically in a specific claim
  const phoneNumber = tokenPayload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/mobilephone"];
  if (!phoneNumber) {
    return NextResponse.json({ isSuccess: false, errors: ["Could not identify user from token. Phone number missing."] }, { status: 401 });
  }


  let requestBody;
  try {
    requestBody = await request.json();
  } catch (e) {
    return NextResponse.json({ isSuccess: false, errors: ["Invalid request format."] }, { status: 400 });
  }

  const { currentPassword, newPassword } = requestBody;

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ isSuccess: false, errors: ["Current password and new password are required."] }, { status: 400 });
  }

  try {
    const externalApiResponse = await fetch(`${AUTH_API_BASE_URL}/api/Auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`, 
      },
      body: JSON.stringify({ phoneNumber, currentPassword, newPassword }),
    });

    // Handle empty response body gracefully
    const responseText = await externalApiResponse.text();
    let responseData;
    if (responseText) {
      try {
        responseData = JSON.parse(responseText);
      } catch (jsonError) {
        // If parsing fails but the status was not OK, it's an error.
        if (!externalApiResponse.ok) {
           return NextResponse.json({ isSuccess: false, errors: [`Authentication service responded with an unreadable body (Status: ${externalApiResponse.status}).`] }, { status: externalApiResponse.status });
        }
        // If status was OK but JSON is invalid, that's also an issue.
         return NextResponse.json({ isSuccess: false, errors: ["Received an invalid JSON response from the authentication service."] }, { status: 500 });
      }
    }

    if (!externalApiResponse.ok) {
      const errorMessages = responseData?.errors || ["Failed to change password."];
      return NextResponse.json({ isSuccess: false, errors: errorMessages }, { status: externalApiResponse.status || 400 });
    }
    
    // If we get here, the external API call was successful (2xx status).
    // Now handle the response data, which might be undefined if the body was empty.
    if (responseData && !responseData.isSuccess) {
      const errorMessages = responseData?.errors || ["Failed to change password."];
      return NextResponse.json({ isSuccess: false, errors: errorMessages }, { status: 400 });
    }
    
    // Success case
    const user = await databaseService.findUserByPhoneNumber(phoneNumber);
    if (user) {
      await databaseService.updateUser(user.id, { tempPassword: null });
    } else {
        console.warn(`Password changed for ${phoneNumber}, but user not found locally to clear temp password.`);
    }

    // After a successful password change, log the user out to force a re-login with the new password.
    if (adminToken) {
        cookieStore.set(ADMIN_ACCESS_TOKEN_KEY, '', { maxAge: -1, path: '/' });
    }
    if (portalToken) {
        cookieStore.set(PORTAL_ACCESS_TOKEN_KEY, '', { maxAge: -1, path: '/' });
    }


    return NextResponse.json({ isSuccess: true, message: "Password changed successfully. Please log in again." });

  } catch (error: any) {
    console.error("Change password error:", error);
    return NextResponse.json({ isSuccess: false, errors: ["An unexpected error occurred."] }, { status: 500 });
  }
}
