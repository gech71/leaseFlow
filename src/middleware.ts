import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Initialize NextAuth with only the config necessary for middleware
const { auth: middleware } = NextAuth(authConfig);

// The middleware now only handles redirection logic.
// It does NOT import the main `auth.ts` file.
export default async function (req: NextRequest) {
  // We need to wrap the middleware call to get the session and then apply custom logic.
  return middleware(async (req) => {
    const session = (req as any).auth; // The session is attached to the request by the middleware

    // If user is authenticated and must change their password,
    // and they are not already on the change-password page, redirect them.
    if (session?.user?.forceChangePass && req.nextUrl.pathname !== '/portal/change-password') {
      return NextResponse.redirect(new URL('/portal/change-password', req.url));
    }

    // If a user is logged in, redirect them from the login page to a dashboard
    if (session && req.nextUrl.pathname === '/login') {
       const isTenant = session.user.roles?.some((role: any) => role.name === 'TENANT') && session.user.roles?.length === 1;
       return NextResponse.redirect(new URL(isTenant ? '/portal/dashboard' : '/admin/dashboard', req.url));
    }
    
    // If no custom logic applies, just let the `authorized` callback handle it
    return NextResponse.next();
  })(req as any, {} as any);
}

export const config = {
  // The matcher is used to run the Middleware on specific paths.
  // This configuration protects all admin and portal routes and handles login page redirects.
  matcher: ['/admin/:path*', '/portal/:path*', '/login'],
};
