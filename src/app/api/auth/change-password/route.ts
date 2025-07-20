
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { databaseService } from '@/lib/services/databaseService';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;
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

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ isSuccess: false, errors: ["Authentication required."] }, { status: 401 });
  }
  const accessToken = authHeader.substring(7);

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
    const externalApiResponse = await fetch(`${AUTH_API_BASE_URL}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`, 
      },
      body: JSON.stringify({ phoneNumber, currentPassword, newPassword }),
    });

    const responseData = await externalApiResponse.json();

    if (!externalApiResponse.ok || !responseData.isSuccess) {
      const errorMessages = responseData?.errors || ["Failed to change password."];
      return NextResponse.json({ isSuccess: false, errors: errorMessages }, { status: externalApiResponse.status || 400 });
    }

    const user = await databaseService.findUserByPhoneNumber(phoneNumber);
    if (user) {
      await databaseService.updateUser(user.id, { tempPassword: null });
    } else {
        console.warn(`Password changed for ${phoneNumber}, but user not found locally to clear temp password.`);
    }

    return NextResponse.json({ isSuccess: true, message: "Password changed successfully." });

  } catch (error: any) {
    console.error("Change password error:", error);
    return NextResponse.json({ isSuccess: false, errors: ["An unexpected error occurred."] }, { status: 500 });
  }
}
