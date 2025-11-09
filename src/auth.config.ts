import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnAdmin = nextUrl.pathname.startsWith('/admin');
      const isOnPortal = nextUrl.pathname.startsWith('/portal');

      if (isOnAdmin || isOnPortal) {
        if (isLoggedIn) return true;
        return false; // Redirect unauthenticated users to login page
      } else if (isLoggedIn) {
        // If the user is logged in and tries to access the login page, redirect them.
        if (nextUrl.pathname === "/login") {
            return Response.redirect(new URL('/admin/dashboard', nextUrl));
        }
        return true;
      }
      // Allow all other requests (like /login) for unauthenticated users
      return true;
    },
  },
  providers: [], // Providers are defined in the main auth.ts file
} satisfies NextAuthConfig;
