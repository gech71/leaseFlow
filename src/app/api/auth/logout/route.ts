
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;
const ACCESS_TOKEN_KEY = 'leaseflow_access_token';
const REFRESH_TOKEN_KEY = 'leaseflow_refresh_token';

export async function POST(request: NextRequest) {
  const cookieStore = cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_KEY)?.value;
  const refreshToken = cookieStore.get(REFRESH_TOKEN_KEY)?.value;

  if (AUTH_API_BASE_URL && accessToken && refreshToken) {
    try {
      await fetch(`${AUTH_API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: accessToken, refreshToken }),
      });
      // We don't strictly need to check the response from external logout
      // Client-side cookies will be cleared regardless.
    } catch (error) {
      console.error("External logout API call error:", error);
      // Proceed with clearing local cookies even if external logout fails
    }
  }

  // Clear the cookies by setting their maxAge to 0
  cookieStore.set(ACCESS_TOKEN_KEY, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'lax',
    maxAge: 0,
  });

  cookieStore.set(REFRESH_TOKEN_KEY, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'lax',
    maxAge: 0,
  });

  return NextResponse.json({ isSuccess: true, message: "Logout successful" });
}
