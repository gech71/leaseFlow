import type { NextAuthConfig } from 'next-auth';
import { credentialsProvider } from './auth.providers';

export const authConfig = {
  trustHost: true,
  providers: [credentialsProvider],
  session: { 
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days, matches refreshToken expiry
  },
  callbacks: {
  },
} satisfies NextAuthConfig;
