
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { databaseService } from '@/lib/services/databaseService';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;
const PORTAL_ACCESS_TOKEN_KEY = 'leaseflow_portal_access_token';
const PORTAL_ACCESS_TOKEN_MAX_AGE = 60 * 60; // 1 hour

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

  const { phoneNumber, password } = await request.json();

  if (!phoneNumber || !password) {
      return NextResponse.json({ isSuccess: false, errors: ["Phone number and password are required."] }, { status: 400 });
  }

  try {
    const externalResponse = await fetch(`${AUTH_API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: phoneNumber, Password: password }),
    });

    const responseData = await externalResponse.json();

    if (!externalResponse.ok || !responseData.isSuccess) {
      return NextResponse.json({ isSuccess: false, errors: responseData?.errors || ["Invalid credentials."] }, { status: externalResponse.status });
    }

    const { accessToken } = responseData;
    if (!accessToken) {
      return NextResponse.json({ isSuccess: false, errors: ["Authentication successful, but no token was provided."] }, { status: 500 });
    }
    
    const tokenPayload = decodeJwtPayload(accessToken);
    if (!tokenPayload) {
      return NextResponse.json({ isSuccess: false, errors: ["Invalid token format received."] }, { status: 500 });
    }

    const requiresPasswordChange = tokenPayload.requiresPasswordChange === 'True' || tokenPayload.requiresPasswordChange === true;
    const userIdFromToken = tokenPayload.sub;
    
    if (!userIdFromToken) {
       return NextResponse.json({ isSuccess: false, errors: ["Token is missing user identifier."] }, { status: 500 });
    }
    
    const localUser = await databaseService.getUserByExternalId(userIdFromToken);
    if (!localUser) {
        return NextResponse.json({ isSuccess: false, errors: ["User not found in this system."] }, { status: 403 });
    }
    
    // If password change is not required, set the session cookie
    if (!requiresPasswordChange) {
        const cookieStore = await cookies();
        cookieStore.set(PORTAL_ACCESS_TOKEN_KEY, accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            sameSite: 'lax',
            maxAge: PORTAL_ACCESS_TOKEN_MAX_AGE,
        });
    }

    return NextResponse.json({
      isSuccess: true,
      redirectPath: '/portal/dashboard',
      requiresPasswordChange,
      accessToken: requiresPasswordChange ? accessToken : undefined // Pass token back if change is needed
    });

  } catch (error) {
    console.error("Portal login API call error:", error);
    return NextResponse.json({ isSuccess: false, errors: ["Could not connect to the authentication service."] }, { status: 503 });
  }
}

