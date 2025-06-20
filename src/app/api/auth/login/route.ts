
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;
const ACCESS_TOKEN_KEY = 'leaseflow_access_token';
const REFRESH_TOKEN_KEY = 'leaseflow_refresh_token';

// Set a reasonable max age for cookies (e.g., access token 1 hour, refresh token 7 days)
const ACCESS_TOKEN_MAX_AGE = 60 * 60; // 1 hour in seconds
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

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
    externalApiResponse = await fetch(`${AUTH_API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phoneNumber, password }),
    });
  } catch (networkError: any) {
    console.error("Network error calling external auth service:", networkError.message);
    return NextResponse.json({ isSuccess: false, errors: ["Failed to connect to authentication service. Please try again later."] }, { status: 503 }); // Service Unavailable
  }

  let responseData;
  try {
    const responseText = await externalApiResponse.text();
    if (responseText) {
      responseData = JSON.parse(responseText);
    } else if (!externalApiResponse.ok) {
      // Non-OK response with empty body
      console.warn(`External auth service returned status ${externalApiResponse.status} with an empty body.`);
      return NextResponse.json(
        { isSuccess: false, errors: [`Authentication failed. Server responded with status: ${externalApiResponse.status}.`] },
        { status: externalApiResponse.status }
      );
    } else {
      // OK response but empty body - unusual for login
      console.warn("External auth service returned an OK status with an empty body for login.");
      return NextResponse.json(
        { isSuccess: false, errors: ["Received an unexpected empty response from authentication service."] },
        { status: 500 }
      );
    }
  } catch (jsonError: any) {
    console.error("Error parsing JSON from external auth service:", jsonError.message);
    // If JSON parsing fails for a non-OK response, return a generic error based on the status
    if (!externalApiResponse.ok) {
        return NextResponse.json(
          { isSuccess: false, errors: [`Authentication failed. Server responded with status: ${externalApiResponse.status} and an invalid response format.`] },
          { status: externalApiResponse.status }
        );
    }
    // If JSON parsing fails for an OK response, this indicates an issue with the auth provider's response format.
    return NextResponse.json({ isSuccess: false, errors: ["Received an invalid response format from authentication service."] }, { status: 500 });
  }

  if (externalApiResponse.ok && responseData && responseData.isSuccess && responseData.accessToken && responseData.refreshToken) {
    const cookieStore = cookies(); // This is synchronous

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
  } else {
    // Handle cases where externalApiResponse was ok, but data.isSuccess is false, or tokens are missing
    const errorMessages = responseData?.errors && Array.isArray(responseData.errors) && responseData.errors.length > 0
      ? responseData.errors
      : [`Login failed. Please check your credentials or contact support. (Status: ${externalApiResponse.status})`];
    
    // Use the status from the external API if available and not OK, otherwise default to 401 or a meaningful error code.
    const responseStatus = !externalApiResponse.ok ? externalApiResponse.status : (responseData?.isSuccess === false ? 401 : 500);
    
    return NextResponse.json(
      { isSuccess: false, errors: errorMessages, accessToken: null, refreshToken: null },
      { status: responseStatus }
    );
  }
}
