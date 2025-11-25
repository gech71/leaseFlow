import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCookieNames } from '@/lib/auth/jwt';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ message: "Logout successful" }, { status: 200 });
  
  // Clear all session-related cookies
  const cookieNames = getSessionCookieNames();
  cookieNames.forEach(name => {
    response.cookies.set(name, '', { expires: new Date(0), path: '/' });
  });

  return response;
}
