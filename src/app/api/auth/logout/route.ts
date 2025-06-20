
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;
const ACCESS_TOKEN_KEY = 'leaseflow_access_token';
const REFRESH_TOKEN_KEY = 'leaseflow_refresh_token';

export async function POST(request: NextRequest) {
  let accessToken, refreshToken;
  try {
    const cookieStoreGetter = cookies(); // Get the cookie store accessor
    accessToken = cookieStoreGetter.get(ACCESS_TOKEN_KEY)?.value;
    refreshToken = cookieStoreGetter.get(REFRESH_TOKEN_KEY)?.value;
  } catch (e) {
    console.error("Error reading cookies for logout:", e);
    // Proceed to clear cookies even if reading fails
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
      console.error("Error calling external logout API:", error);
    }
  }

  try {
    const cookieStoreSetter = await cookies(); // As per user instruction for setting

    cookieStoreSetter.set(ACCESS_TOKEN_KEY, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
      maxAge: 0, 
    });

    cookieStoreSetter.set(REFRESH_TOKEN_KEY, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
      maxAge: 0, 
    });
  } catch (cookieError: any) {
      console.error("Error clearing cookies during logout:", cookieError.message);
      // Even if clearing fails, we should inform the client the logout was attempted
      return NextResponse.json({ isSuccess: false, message: "Logout processed, but cookie clearing encountered an issue." }, { status: 500 });
  }


  return NextResponse.json({ isSuccess: true, message: "Logout successful" });
}
