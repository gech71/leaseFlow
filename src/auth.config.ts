import type { NextAuthConfig } from 'next-auth';
import { credentialsProvider } from './auth.providers';

export const authConfig = {
  trustHost: true,
  providers: [credentialsProvider],
  session: { strategy: 'jwt' },
  callbacks: {
  },
} satisfies NextAuthConfig;
