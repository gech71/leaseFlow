
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { databaseService } from '@/lib/services/databaseService'; // Import databaseService

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;
const ACCESS_TOKEN_KEY = 'leaseflow_access_token';
const REFRESH_TOKEN_KEY = 'leaseflow_refresh_token';

const ACCESS_TOKEN_MAX_AGE = 60 * 60; // 1 hour in seconds
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

// Insecure JWT payload decoder for prototype purposes ONLY.
// DO NOT USE IN PRODUCTION. Use a proper JWT library (e.g., jose).
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
    return NextResponse.json({ isSuccess: false, errors: ["Authentication service is not configured. Please contact support."] }, { status: 500 });
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
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phoneNumber, password }),
    });
  } catch (networkError: any) {
    console.error("Network error calling external auth service:", networkError.message);
    return NextResponse.json({ isSuccess: false, errors: ["Failed to connect to authentication service. Please try again later."] }, { status: 503 });
  }

  let responseText;
  try {
    responseText = await externalApiResponse.text();
  } catch (textError: any) {
    console.error("Error reading response text from external auth service:", textError.message);
    return NextResponse.json(
      { isSuccess: false, errors: [`Authentication failed. Server responded with an unreadable body (Status: ${externalApiResponse.status}).`] },
      { status: externalApiResponse.status || 500 }
    );
  }

  let responseData;
  if (responseText) {
    try {
      responseData = JSON.parse(responseText);
    } catch (jsonError: any) {
      console.error("Error parsing JSON from external auth service:", jsonError.message, "Response text:", responseText);
      if (!externalApiResponse.ok) {
        return NextResponse.json(
          { isSuccess: false, errors: [`Authentication failed. Server responded with status: ${externalApiResponse.status} and an invalid JSON response format.`] },
          { status: externalApiResponse.status }
        );
      }
      return NextResponse.json({ isSuccess: false, errors: ["Received an invalid JSON response format from authentication service."] }, { status: 500 });
    }
  } else {
    if (!externalApiResponse.ok) {
      console.warn(`External auth service returned status ${externalApiResponse.status} with an empty body.`);
      return NextResponse.json(
        { isSuccess: false, errors: [`Authentication failed. Server responded with status: ${externalApiResponse.status} and an empty response.`] },
        { status: externalApiResponse.status }
      );
    }
    console.warn("External auth service returned an OK status with an empty body for login.");
    return NextResponse.json(
      { isSuccess: false, errors: ["Received an unexpected empty response from authentication service."] },
      { status: 500 }
    );
  }

  if (externalApiResponse.ok && responseData && responseData.isSuccess && responseData.accessToken && responseData.refreshToken) {
    // External authentication successful, now fetch user from local DB
    const externalTokenPayload = decodeJwtPayload(responseData.accessToken);
    if (!externalTokenPayload || !externalTokenPayload.sub) {
      console.error("Failed to decode external access token or 'sub' claim is missing.");
      return NextResponse.json({ isSuccess: false, errors: ["Authentication process error: Invalid token structure from identity provider."] }, { status: 500 });
    }

    const externalUserId = externalTokenPayload.sub;

    try {
      // Corrected the structure of the include object here
      const localUser = await databaseService.getUserByExternalId(externalUserId, { roles: true });

      if (!localUser) {
        console.warn(`User ${externalUserId} authenticated externally but not found in local database.`);
        return NextResponse.json({ isSuccess: false, errors: ["User not provisioned in this system. Please contact support."] }, { status: 403 });
      }

      // User found locally, proceed to set cookies
      // console.log("Local user found:", localUser.email, "Roles:", localUser.roles.map(r => r.name)); // For debugging

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

      return NextResponse.json({ isSuccess: true, message: "Login successful" });

    } catch (dbError: any) {
      console.error("Database error during login user retrieval:", dbError.message);
      return NextResponse.json({ isSuccess: false, errors: ["Login process error: Could not verify user against local system."] }, { status: 500 });
    }

  } else {
    const errorMessages = responseData?.errors && Array.isArray(responseData.errors) && responseData.errors.length > 0
      ? responseData.errors
      : [`Login failed. Please check your credentials or contact support. (Status: ${externalApiResponse.status})`];
    
    const responseStatus = !externalApiResponse.ok ? externalApiResponse.status : (responseData?.isSuccess === false ? 401 : 500);
    
    return NextResponse.json(
      { isSuccess: false, errors: errorMessages, accessToken: null, refreshToken: null },
      { status: responseStatus }
    );
  }
}
