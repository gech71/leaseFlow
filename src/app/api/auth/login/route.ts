
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
    return NextResponse.json({ isSuccess: false, errors: ["Authentication service URL is not configured."] }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { phoneNumber, password } = body;

    if (!phoneNumber || !password) {
      return NextResponse.json({ isSuccess: false, errors: ["Phone number and password are required."] }, { status: 400 });
    }

    const externalApiResponse = await fetch(`${AUTH_API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phoneNumber, password }),
    });

    const data = await externalApiResponse.json();

    if (externalApiResponse.ok && data.isSuccess && data.accessToken && data.refreshToken) {
      const cookieStore = cookies();

      cookieStore.set(ACCESS_TOKEN_KEY, data.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        sameSite: 'lax',
        maxAge: ACCESS_TOKEN_MAX_AGE,
      });

      cookieStore.set(REFRESH_TOKEN_KEY, data.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        sameSite: 'lax',
        maxAge: REFRESH_TOKEN_MAX_AGE,
      });

      return NextResponse.json({ isSuccess: true, message: "Login successful" });
    } else {
      return NextResponse.json(
        { isSuccess: false, errors: data.errors || ["Invalid phone number or password."] },
        { status: externalApiResponse.status }
      );
    }
  } catch (error) {
    console.error("API login route error:", error);
    return NextResponse.json({ isSuccess: false, errors: ["An unexpected error occurred during login."] }, { status: 500 });
  }
}
