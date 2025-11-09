
import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Session } from 'next-auth';

// Initialize NextAuth with only the config necessary for middleware
const { auth: middleware } = NextAuth(authConfig);

// The middleware now only handles redirection logic.
// It does NOT import the main `auth.ts` file.
export default async function (req: NextRequest) {
  // We need to wrap the middleware call to get the session and then apply custom logic.
  return middleware(async (req) => {
    const session = (req as any).auth as Session | null;
    const { pathname } = req.nextUrl;

    const isTenant = session?.user?.roles?.some((role: any) => role.name === 'TENANT') && session.user.roles?.length === 1;

    // 1. User MUST change password
    if (session?.user?.forceChangePass) {
      // If user must change password and is NOT on the change password page, redirect them there.
      if (!pathname.startsWith('/portal/change-password')) {
        return NextResponse.redirect(new URL('/portal/change-password', req.url));
      }
      // If they are on the correct page, allow them to proceed.
      return NextResponse.next();
    }

    // 2. Handle the change password page access for users who DON'T need to change password
    if (pathname.startsWith('/portal/change-password') && !session?.user?.forceChangePass) {
        // If a logged-in user without the flag tries to access it, send them to their dashboard.
        if (session) {
            const dashboardUrl = isTenant ? '/portal/dashboard' : '/admin/dashboard';
            return NextResponse.redirect(new URL(dashboardUrl, req.url));
        }
        // If a non-logged-in user tries to access it, send them to login.
        return NextResponse.redirect(new URL('/login', req.url));
    }
    
    // 3. Handle login page access for already logged-in users
    if (session && pathname.startsWith('/login')) {
       const dashboardUrl = isTenant ? '/portal/dashboard' : '/admin/dashboard';
       return NextResponse.redirect(new URL(dashboardUrl, req.url));
    }
    
    // 4. Default behavior (handled by `authorized` callback in auth.config.ts)
    // If no specific rule matches, let the default authorization logic decide.
    // The `authorized` callback will deny access to protected routes if there's no session.
    return NextResponse.next();
    
  })(req as any, {} as any);
}

export const config = {
  // The matcher is used to run the Middleware on specific paths.
  // This configuration protects all admin and portal routes and handles login page redirects.
  // It also includes the change-password page itself to ensure it's evaluated by the middleware.
  matcher: ['/admin/:path*', '/portal/:path*', '/login'],
};
