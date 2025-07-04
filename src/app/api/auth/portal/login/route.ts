
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { databaseService } from '@/lib/services/databaseService';

// PORTAL SPECIFIC LOGIN
const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;
const ACCESS_TOKEN_KEY = 'leaseflow_portal_access_token';
const REFRESH_TOKEN_KEY = 'leaseflow_portal_refresh_token';
const ACCESS_TOKEN_MAX_AGE = 60 * 60; // 1 hour in seconds
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

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
    console.error("Authentication service URL (NEXT_PUBLIC_AUTH_API_BASE_URL) is not configured.");
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

  let externalApiResponse: Response;
  try {
    externalApiResponse = await fetch(`${AUTH_API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber, password }),
    });
  } catch (networkError: any) {
    console.error("Network error calling external auth service for portal:", networkError.message);
    return NextResponse.json({ isSuccess: false, errors: ["Failed to connect to authentication service."] }, { status: 503 });
  }

  const responseData = await externalApiResponse.json();

  if (externalApiResponse.ok && responseData?.isSuccess) {
    const externalTokenPayload = decodeJwtPayload(responseData.accessToken);
    if (!externalTokenPayload || !externalTokenPayload.sub) {
      return NextResponse.json({ isSuccess: false, errors: ["Invalid token from identity provider."] }, { status: 500 });
    }

    const localUser = await databaseService.getUserByExternalId(externalTokenPayload.sub, { roles: true });
    if (!localUser) {
      return NextResponse.json({ isSuccess: false, errors: ["User not found in the system."] }, { status: 403 });
    }

    const hasPortalAccess = localUser.roles.some(role => role.permissions.includes('portal:view'));
    if (!hasPortalAccess) {
      return NextResponse.json({ isSuccess: false, errors: ["This account does not have permission to access the tenant portal."] }, { status: 403 });
    }

    const cookieStore = await cookies();
    cookieStore.set(ACCESS_TOKEN_KEY, responseData.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
      maxAge: ACCESS_TOKEN_MAX_AGE,
    });
    cookieStore.set(REFRESH_TOKEN_KEY, responseData.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });

    return NextResponse.json({ isSuccess: true, message: "Login successful", redirectPath: '/portal/dashboard' });
  } else {
    return NextResponse.json({ isSuccess: false, errors: responseData.errors || ["Login failed."] }, { status: externalApiResponse.status });
  }
}
