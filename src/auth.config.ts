import type { NextAuthConfig } from 'next-auth';
import { credentialsProvider } from './auth.providers';
import NextAuth from 'next-auth';

// This object contains the parts of the configuration that don't depend on the main NextAuth function
// This allows it to be safely imported by other files like middleware.
export const authConfig: NextAuthConfig = {
  trustHost: true,
  providers: [credentialsProvider],
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days, matches refreshToken expiry
  },
  callbacks: {}, // Callbacks with logic will be in auth.ts
  pages: {
    signIn: "/login",
    error: "/login",
  },
};

// We also export the initialized handlers here for use in the API route, though it's often cleaner to do this once in the main auth.ts
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
