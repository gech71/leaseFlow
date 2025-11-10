import type { NextAuthConfig } from 'next-auth';
import { credentialsProvider } from './auth.providers';

export const authConfig = {
  pages: {
    signIn: '/login',
    error: '/login', // Redirect users to login page on error
  },
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
