
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;
const ACCESS_TOKEN_KEY = 'leaseflow_access_token';
const REFRESH_TOKEN_KEY = 'leaseflow_refresh_token';

export async function POST(request: NextRequest) {
  const accessToken = cookies().get(ACCESS_TOKEN_KEY)?.value;
  const refreshToken = cookies().get(REFRESH_TOKEN_KEY)?.value;

  if (AUTH_API_BASE_URL && accessToken && refreshToken) {
    try {
      // Ensure /api/ is included
      await fetch(`${AUTH_API_BASE_URL}/api/auth/logout`, { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Body might vary based on your identity server's requirements
        body: JSON.stringify({ token: accessToken, refreshToken }), 
      });
      // We don't typically need to check the response of the external logout
      // as we'll clear local cookies regardless.
    } catch (error) {
      // Log error but proceed to clear local cookies
      console.error("Error calling external logout API:", error);
    }
  }

  // Clear the cookies by setting them with an immediate expiry (maxAge: 0)
  // Directly use cookies().set()
  cookies().set(ACCESS_TOKEN_KEY, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'lax',
    maxAge: 0, // Expire immediately
  });

  cookies().set(REFRESH_TOKEN_KEY, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'lax',
    maxAge: 0, // Expire immediately
  });

  return NextResponse.json({ isSuccess: true, message: "Logout successful" });
}
