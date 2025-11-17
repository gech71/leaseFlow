import type { NextAuthConfig } from 'next-auth';
import { credentialsProvider } from './auth.providers';

export const authConfig = {
  trustHost: true,
  providers: [credentialsProvider],
  session: { strategy: 'jwt' },
  callbacks: {
    // The authorized callback is removed to prevent setting the authjs.callback-url cookie.
    // We now rely on middleware for route protection.
  },
} satisfies NextAuthConfig;
