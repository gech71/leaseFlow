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
      
      const isOnProtectedRoue = nextUrl.pathname.startsWith('/admin') || nextUrl.pathname.startsWith('/portal');

      if (isOnProtectedRoue) {
        if (isLoggedIn) return true; // If logged in, allow middleware to handle logic.
        return false; // Redirect unauthenticated users to login page
      } else if (isLoggedIn) {
        // If the user is logged in and tries to access a public page like /login,
        // redirect them to a relevant dashboard.
        const isTenant = auth.user.roles?.some((role: any) => role.name === 'TENANT') && auth.user.roles?.length === 1;
        return NextResponse.redirect(new URL(isTenant ? '/portal/dashboard' : '/admin/dashboard', nextUrl));
      }
      
      return true; // Allow all other unauthenticated requests
    },
    // JWT and Session callbacks are handled in auth.ts
  },
  providers: [], // Providers are defined in the main auth.ts file
} satisfies NextAuthConfig;
