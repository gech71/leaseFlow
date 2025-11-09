import type { NextAuthConfig } from 'next-auth';
 
export const authConfig = {
  pages: {
    signIn: '/login', // All failed sign-ins will redirect here
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/admin/dashboard');
      const isOnAdmin = nextUrl.pathname.startsWith('/admin');
      const isOnPortal = nextUrl.pathname.startsWith('/portal');

      if (isOnAdmin || isOnPortal) {
        if (isLoggedIn) return true;
        return false; // Redirect unauthenticated users to login page
      } else if (isLoggedIn) {
        // If the user is logged in and tries to access the login page, redirect them to the dashboard.
        if (nextUrl.pathname === "/login") {
            return Response.redirect(new URL('/admin/dashboard', nextUrl));
        }
        return true;
      }
      
      // Allow all other requests for unauthenticated users (e.g., login page)
      return true;
    },
  },
  providers: [], // Add providers in the main auth.ts file
} satisfies NextAuthConfig;
