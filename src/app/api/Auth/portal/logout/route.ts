
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';

// PORTAL SPECIFIC LOGOUT
const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;
const ACCESS_TOKEN_KEY = 'leaseflow_portal_access_token';
const REFRESH_TOKEN_KEY = 'leaseflow_portal_refresh_token';

export async function POST(request: NextRequest) {
  let accessToken, refreshToken;
  const cookieStore = await cookies();
  try {
    accessToken = cookieStore.get(ACCESS_TOKEN_KEY)?.value;
    refreshToken = cookieStore.get(REFRESH_TOKEN_KEY)?.value;
  } catch (e) {
    console.error("Error reading portal cookies for logout:", e);
  }

  if (AUTH_API_BASE_URL && accessToken && refreshToken) {
    try {
      await fetch(`${AUTH_API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: accessToken, refreshToken }),
      });
    } catch (error) {
      console.error("Error calling external logout API for portal:", error);
    }
  }

  try {
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
  } catch (cookieError: any) {
    console.error("Error clearing portal cookies during logout:", cookieError.message);
    return NextResponse.json({ isSuccess: false, message: "Logout processed, but cookie clearing encountered an issue." }, { status: 500 });
  }

  return NextResponse.json({ isSuccess: true, message: "Logout successful" });
}
