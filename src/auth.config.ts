import type { NextAuthConfig } from 'next-auth';
 
export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
     // The authorized callback is used to verify if a request is authorized to access a page.
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnAdmin = nextUrl.pathname.startsWith('/admin');
      const isOnPortal = nextUrl.pathname.startsWith('/portal');

      if (isOnAdmin || isOnPortal) {
        if (isLoggedIn) return true;
        return false; // Redirect unauthenticated users to login page
      } else if (isLoggedIn) {
        // If the user is logged in and tries to access the login page, redirect them to the dashboard.
        if (nextUrl.pathname.startsWith("/login")) {
            return Response.redirect(new URL('/admin/dashboard', nextUrl));
        }
        return true;
      }
      // Allow all other requests (e.g., for the login page itself) for unauthenticated users.
      return true;
    },
  },
  providers: [], // Add providers in the main auth.ts file
} satisfies NextAuthConfig;