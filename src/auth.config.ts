import type { NextAuthConfig } from 'next-auth';
import { credentialsProvider } from './auth.providers';

export const authConfig = {
  pages: {
    signIn: '/login',
    error: '/login',
  },
  trustHost: true,
  providers: [credentialsProvider],
  session: { strategy: 'jwt' },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnAdminArea = nextUrl.pathname.startsWith('/admin');
      
      if (isOnAdminArea) {
        if (isLoggedIn) return true;
        return false;
      }
      
      return true;
    },
  },
} satisfies NextAuthConfig;
