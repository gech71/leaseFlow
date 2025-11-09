
import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
    // We don't define an error page, so it redirects to signIn with an error query param
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnAdminRoute = nextUrl.pathname.startsWith('/admin');
      const isOnPortalRoute = nextUrl.pathname.startsWith('/portal');

      if (isOnAdminRoute || isOnPortalRoute) {
        if (isLoggedIn) return true; // Allow access if logged in
        return false; // Redirect unauthenticated users to login page
      } 
      
      // If a logged-in user tries to access the login page, redirect them away.
      if (isLoggedIn && nextUrl.pathname === '/login') {
        const user = auth.user as any; // Cast to access roles
        // Redirect tenants to portal, others to admin dashboard
        const isTenant = user.roles?.some((role: any) => role.name === 'TENANT') && user.roles?.length === 1;
        return Response.redirect(new URL(isTenant ? '/portal/dashboard' : '/admin/dashboard', nextUrl));
      }
      
      // Allow all other requests for unauthenticated users (e.g., viewing the login page itself)
      return true;
    },
  },
  providers: [], // Providers are defined in the main auth.ts file
} satisfies NextAuthConfig;
