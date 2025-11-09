
import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from './auth'; // Import the auth function directly

// The main authentication function from NextAuth.js
const { auth: middleware } = NextAuth(authConfig);

export default async function (req: NextRequest) {
  // First, get the session to check for the forceChangePass flag
  const session = await auth();

  // If user is authenticated and must change their password,
  // and they are not already on the change-password page, redirect them.
  if (session?.user?.forceChangePass && req.nextUrl.pathname !== '/portal/change-password') {
    return NextResponse.redirect(new URL('/portal/change-password', req.url));
  }

  // If no special condition is met, run the default NextAuth.js middleware
  // which handles protecting routes and redirecting to login if not authenticated.
  return middleware(req);
}

export const config = {
  // The matcher is used to run the Middleware on specific paths.
  // This configuration protects all admin and portal routes.
  matcher: ['/admin/:path*', '/portal/:path*'],
};
