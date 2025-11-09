
import type { NextAuthConfig } from 'next-auth';
import { NextResponse } from 'next/server';
import type { User as AuthUser } from 'next-auth';

// Extend the User type to include our custom properties
interface AppUser extends AuthUser {
  roles?: { name: string }[];
  forceChangePass?: boolean;
}

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const user = auth?.user as AppUser | undefined;

      const isOnAdminRoute = nextUrl.pathname.startsWith('/admin');
      const isOnPortalRoute = nextUrl.pathname.startsWith('/portal');

      if (isOnAdminRoute || isOnPortalRoute) {
        if (!isLoggedIn) {
          // If not logged in, redirect to login page.
          return false;
        }

        // If user is logged in, check if they need to change their password
        if (user?.forceChangePass && nextUrl.pathname !== '/portal/change-password') {
            return NextResponse.redirect(new URL('/portal/change-password', nextUrl));
        }

        // If user is logged in, check their role for admin routes.
        if (isOnAdminRoute) {
          const isTenantOnly = user?.roles?.some(role => role.name === 'TENANT') && user.roles.length === 1;
          if (isTenantOnly) {
            // If a tenant tries to access an admin route, redirect them to their portal.
            return NextResponse.redirect(new URL('/portal/dashboard', nextUrl));
          }
        }
        
        // If logged in and not requiring a password change, allow access.
        return true;
      }
      
      // If a logged-in user tries to access a public page like /login
      if (isLoggedIn) {
        // But they must change their password, force them to the change password page
        if (user?.forceChangePass) {
            return Response.redirect(new URL('/portal/change-password', nextUrl));
        }
        
        const isTenant = user?.roles?.some((role: any) => role.name === 'TENANT') && user.roles?.length === 1;
        
        // If on the login page, redirect away.
        if (nextUrl.pathname === '/login') {
            return Response.redirect(new URL(isTenant ? '/portal/dashboard' : '/admin/dashboard', nextUrl));
        }
      }
      
      // Allow all other unauthenticated requests (e.g., to the login page itself).
      return true;
    },
  },
  providers: [], // Providers are defined in the main auth.ts file
} satisfies NextAuthConfig;
