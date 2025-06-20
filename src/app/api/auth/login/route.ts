
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;
const ACCESS_TOKEN_KEY = 'leaseflow_access_token';
const REFRESH_TOKEN_KEY = 'leaseflow_refresh_token';

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
    externalApiResponse = await fetch(`${AUTH_API_BASE_URL}/api/auth/login`, { // Ensure /api/ is included
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

  let responseData;
  try {
    const responseText = await externalApiResponse.text();
    if (responseText) {
      responseData = JSON.parse(responseText);
    } else {
      // Handle empty response body, especially for errors
      if (!externalApiResponse.ok) {
        console.warn(`External auth service returned status ${externalApiResponse.status} with an empty body.`);
        return NextResponse.json(
          { isSuccess: false, errors: [`Authentication failed. Server responded with status: ${externalApiResponse.status}.`] },
          { status: externalApiResponse.status }
        );
      }
      // If OK but empty, this is unusual for a login response with tokens
      console.warn("External auth service returned an OK status with an empty body for login.");
      return NextResponse.json(
        { isSuccess: false, errors: ["Received an unexpected empty response from authentication service."] },
        { status: 500 }
      );
    }
  } catch (jsonError: any) {
    console.error("Error parsing JSON from external auth service:", jsonError.message);
     if (!externalApiResponse.ok) { // If parsing failed for an error response
        return NextResponse.json(
          { isSuccess: false, errors: [`Authentication failed. Server responded with status: ${externalApiResponse.status} and an invalid response format.`] },
          { status: externalApiResponse.status }
        );
    }
    // If parsing failed for a success response (which shouldn't happen if API is correct)
    return NextResponse.json({ isSuccess: false, errors: ["Received an invalid response format from authentication service."] }, { status: 500 });
  }

  if (externalApiResponse.ok && responseData && responseData.isSuccess && responseData.accessToken && responseData.refreshToken) {
    // Directly use cookies().set()
    cookies().set(ACCESS_TOKEN_KEY, responseData.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
      maxAge: ACCESS_TOKEN_MAX_AGE,
    });

    cookies().set(REFRESH_TOKEN_KEY, responseData.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });

    return NextResponse.json({ isSuccess: true, message: "Login successful" });
  } else {
    const errorMessages = responseData?.errors && Array.isArray(responseData.errors) && responseData.errors.length > 0
      ? responseData.errors
      : [`Login failed. Please check your credentials or contact support. (Status: ${externalApiResponse.status})`];
    
    // Determine status: use external API's status if not ok, otherwise determine from responseData
    const responseStatus = !externalApiResponse.ok ? externalApiResponse.status : (responseData?.isSuccess === false ? 401 : 500);
    
    return NextResponse.json(
      { isSuccess: false, errors: errorMessages, accessToken: null, refreshToken: null },
      { status: responseStatus }
    );
  }
}
