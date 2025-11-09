
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

    const isLoggedIn = !!session?.user;

    // RULE 1: User MUST change password.
    if (isLoggedIn && session.user.forceChangePass) {
      // If user must change password and is NOT on the change password page, redirect them there.
      if (!pathname.startsWith('/portal/change-password')) {
        return NextResponse.redirect(new URL('/portal/change-password', req.url));
      }
      // If they are on the correct page, allow them to proceed.
      return NextResponse.next();
    }

    // RULE 2: A user who does NOT need to change their password CANNOT access the change password page.
    if (isLoggedIn && !session.user.forceChangePass && pathname.startsWith('/portal/change-password')) {
        const isTenant = session.user.roles?.some((role: any) => role.name === 'TENANT');
        const dashboardUrl = isTenant ? '/portal/dashboard' : '/admin/dashboard';
        return NextResponse.redirect(new URL(dashboardUrl, req.url));
    }
    
    // RULE 3: Already logged-in users trying to access the login page are redirected to their dashboard.
    if (isLoggedIn && pathname.startsWith('/login')) {
       const isTenant = session.user.roles?.some((role: any) => role.name === 'TENANT');
       const dashboardUrl = isTenant ? '/portal/dashboard' : '/admin/dashboard';
       return NextResponse.redirect(new URL(dashboardUrl, req.url));
    }
    
    // RULE 4: Default behavior (handled by `authorized` callback in auth.config.ts)
    // If no specific rule matches, let the default authorization logic decide.
    // The `authorized` callback will deny access to protected routes if there's no session.
    return NextResponse.next();
    
  })(req as any, {} as any);
}

export const config = {
  // This matcher ensures the middleware runs on all relevant pages,
  // including the login page and the change password page itself.
  matcher: ['/admin/:path*', '/portal/:path*', '/login'],
};
