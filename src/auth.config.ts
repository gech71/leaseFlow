import type { NextAuthConfig } from 'next-auth';
import { credentialsProvider } from './auth.providers';

export const authConfig = {
  trustHost: true, // Add this line to trust the host
  providers: [credentialsProvider],
  session: { strategy: 'jwt' },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnAdminArea = nextUrl.pathname.startsWith('/admin');
      
      if (isOnAdminArea) {
        if (isLoggedIn) return true;
        return false; // Redirect unauthenticated users to login page
      }
      
      // Allow access to login page and other public pages
      return true;
    },
  },
} satisfies NextAuthConfig;
