
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { databaseService } from '@/lib/services/databaseService';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;
const ACCESS_TOKEN_KEY = 'leaseflow_admin_access_token'; // Unified access token
const REFRESH_TOKEN_KEY = 'leaseflow_admin_refresh_token'; // Unified refresh token

// Insecure JWT payload decoder for prototype purposes. Not for production.
function decodeJwtPayload(token: string): any | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const jsonPayload = decodeURIComponent(atob(base64Url.replace(/-/g, '+').replace(/_/g, '/')).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (!AUTH_API_BASE_URL) {
    console.error("Auth API base URL is not configured.");
    return NextResponse.json({ isSuccess: false, errors: ["Authentication service is not configured."] }, { status: 500 });
  }

  let credentials;
  try {
    credentials = await request.json();
  } catch (e) {
    return NextResponse.json({ isSuccess: false, errors: ["Invalid request format."] }, { status: 400 });
  }

  const { phoneNumber, password } = credentials;
  if (!phoneNumber || !password) {
      return NextResponse.json({ isSuccess: false, errors: ["Phone number and password are required."] }, { status: 400 });
  }


  try {
    // 1. Authenticate against the external identity provider
    const externalResponse = await fetch(`${AUTH_API_BASE_URL}/api/Auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: phoneNumber, password: password }),
    });

    const responseText = await externalResponse.text();
    
    if (!responseText) {
        console.error("Login Error: Received an empty response from the identity server.");
        return NextResponse.json({ isSuccess: false, errors: ["Authentication service returned an empty response."] }, { status: 500 });
    }

    let responseData;
    try {
        responseData = JSON.parse(responseText);
    } catch (e) {
        console.error("Login Error: Failed to parse JSON response from identity server.", responseText);
        return NextResponse.json({ isSuccess: false, errors: ["Received an invalid response from the authentication service."] }, { status: 500 });
    }

    if (!externalResponse.ok || !responseData.isSuccess) {
      const errorMessages = responseData?.errors || ["Invalid credentials or authentication failed."];
      return NextResponse.json({ isSuccess: false, errors: errorMessages }, { status: externalResponse.status });
    }
    
    const { accessToken, refreshToken } = responseData;
    if (!accessToken || !refreshToken) {
      return NextResponse.json({ isSuccess: false, errors: ["Authentication successful, but tokens were not provided."] }, { status: 500 });
    }

    // 2. Decode token to get user ID
    const tokenPayload = decodeJwtPayload(accessToken);
    if (!tokenPayload) {
      return NextResponse.json({ isSuccess: false, errors: ["Invalid token format received."] }, { status: 500 });
    }
    
    const userIdFromToken = tokenPayload.sub;
    if (!userIdFromToken) {
       return NextResponse.json({ isSuccess: false, errors: ["Token is missing user identifier (sub)."] }, { status: 500 });
    }
    
    // 3. Verify user exists in the local database and check their roles/temp password
    const localUser = await databaseService.getUserByExternalId(userIdFromToken, { roles: true });
    if (!localUser) {
        console.warn(`Login Warning: User ${userIdFromToken} authenticated successfully but is not found or provisioned in the local system.`);
        return NextResponse.json({ isSuccess: false, errors: ["Login successful, but this user is not configured for access to this system. Please contact an administrator."] }, { status: 403 });
    }

    // Check if the user has a temporary password set
    const requiresPasswordChange = !!localUser.tempPassword;

    // Determine user type and redirect path
    const isTenantOnly = localUser.roles.length === 1 && localUser.roles[0].name === 'TENANT';
    const redirectPath = isTenantOnly ? '/portal/dashboard' : '/admin/dashboard';
    
    // 4. Set cookies if password change is NOT required
    if (!requiresPasswordChange) {
      const cookieStore = await cookies();
      cookieStore.set(ACCESS_TOKEN_KEY, accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        sameSite: 'lax',
      });
      cookieStore.set(REFRESH_TOKEN_KEY, refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        sameSite: 'lax',
      });
    }
    
    // 5. Return appropriate response
    return NextResponse.json({ 
      isSuccess: true, 
      redirectPath,
      requiresPasswordChange,
      accessToken: requiresPasswordChange ? accessToken : undefined, // Send token back if change is needed
    });

  } catch (error) {
    console.error("Login API call error:", error);
    return NextResponse.json({ isSuccess: false, errors: ["Could not connect to the authentication service."] }, { status: 503 });
  }
}
