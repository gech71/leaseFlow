import type { NextAuthConfig } from 'next-auth';
import type { User as AuthUser } from 'next-auth';

// Extend the User type to include our custom properties from the token
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
      const isOnProtectedRoue = nextUrl.pathname.startsWith('/admin') || nextUrl.pathname.startsWith('/portal');

      if (isOnProtectedRoue) {
        if (isLoggedIn) {
          return true; // Allow access, middleware will handle redirects if necessary
        }
        return false; // Redirect unauthenticated users to login page
      } 
      // For non-protected routes, we let the middleware handle login page redirects.
      // Returning true allows the request to proceed.
      return true; 
    },
    // The main JWT and Session callbacks are now in the primary auth.ts file.
  },
  providers: [], // Providers are defined in the main auth.ts file
} satisfies NextAuthConfig;
