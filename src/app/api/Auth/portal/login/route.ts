
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { databaseService } from '@/lib/services/databaseService';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;
const ACCESS_TOKEN_KEY = 'leaseflow_portal_access_token';
const REFRESH_TOKEN_KEY = 'leaseflow_portal_refresh_token';
const ACCESS_TOKEN_MAX_AGE = 60 * 60; // 1 hour
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// Insecure JWT payload decoder
function decodeJwtPayload(token: string): any | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
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

  let requestBody;
  try {
    requestBody = await request.json();
  } catch (e) {
    return NextResponse.json({ isSuccess: false, errors: ["Invalid request format."] }, { status: 400 });
  }

  const { phoneNumber, password } = requestBody;

  if (!phoneNumber || !password) {
    return NextResponse.json({ isSuccess: false, errors: ["Phone number and password are required."] }, { status: 400 });
  }

  try {
    const externalApiResponse = await fetch(`${AUTH_API_BASE_URL}/api/Auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber, password }),
    });

    const responseData = await externalApiResponse.json();

    if (!externalApiResponse.ok || !responseData.isSuccess) {
      const errorMessages = responseData?.errors || ["Invalid credentials."];
      return NextResponse.json({ isSuccess: false, errors: errorMessages }, { status: 401 });
    }

    const { accessToken, refreshToken } = responseData;
    const tokenPayload = decodeJwtPayload(accessToken);
    if (!tokenPayload || !tokenPayload.sub) {
      return NextResponse.json({ isSuccess: false, errors: ["Invalid token from authentication service."] }, { status: 500 });
    }

    const localUser = await databaseService.getUserByExternalId(tokenPayload.sub, { roles: true });

    if (!localUser) {
      return NextResponse.json({ isSuccess: false, errors: ["Your account is not recognized by this system. Please contact support."] }, { status: 403 });
    }
    
    // Check for TENANT role (or SUPER_ADMIN for testing purposes)
    const isTenant = localUser.roles.some(role => role.name === 'TENANT');
    const isSuperAdmin = localUser.roles.some(role => role.name === 'SUPER_ADMIN');

    if (!isTenant && !isSuperAdmin) {
      return NextResponse.json({ isSuccess: false, errors: ["This login is for tenants only. Please use the admin login for other roles."] }, { status: 403 });
    }

    // Check for temporary password
    if (localUser.tempPassword && localUser.tempPassword === password) {
      // User is logging in with the temporary password.
      // Set the access token so they can call the change-password API.
      const cookieStore = await cookies();
      cookieStore.set(ACCESS_TOKEN_KEY, accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        sameSite: 'lax',
        maxAge: ACCESS_TOKEN_MAX_AGE,
      });
      // Don't set refresh token yet.
      return NextResponse.json({ isSuccess: true, requiresPasswordChange: true, message: "Please change your temporary password.", accessToken });
    }

    const cookieStore = await cookies();
    cookieStore.set(ACCESS_TOKEN_KEY, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
      maxAge: ACCESS_TOKEN_MAX_AGE,
    });
    cookieStore.set(REFRESH_TOKEN_KEY, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });

    return NextResponse.json({ isSuccess: true, message: "Login successful", redirectPath: '/portal/dashboard' });

  } catch (error: any) {
    console.error("Portal login error:", error);
    return NextResponse.json({ isSuccess: false, errors: ["An unexpected error occurred."] }, { status: 500 });
  }
}

    