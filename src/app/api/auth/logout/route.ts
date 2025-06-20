
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;
const ACCESS_TOKEN_KEY = 'leaseflow_access_token';
const REFRESH_TOKEN_KEY = 'leaseflow_refresh_token';

export async function POST(request: NextRequest) {
  // Access request cookies using cookies().get()
  const accessToken = cookies().get(ACCESS_TOKEN_KEY)?.value;
  const refreshToken = cookies().get(REFRESH_TOKEN_KEY)?.value;

  if (AUTH_API_BASE_URL && accessToken && refreshToken) {
    try {
      await fetch(`${AUTH_API_BASE_URL}/api/auth/logout`, { // Updated path
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: accessToken, refreshToken }), // Assuming your identity server needs these
      });
    } catch (error) {
      console.error("External logout API call error:", error);
    }
  }

  // Clear the cookies by setting their maxAge to 0 using cookies().set()
  cookies().set(ACCESS_TOKEN_KEY, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'lax',
    maxAge: 0,
  });

  cookies().set(REFRESH_TOKEN_KEY, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'lax',
    maxAge: 0,
  });

  return NextResponse.json({ isSuccess: true, message: "Logout successful" });
}
