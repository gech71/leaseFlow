
import type { NextAuthConfig } from 'next-auth';
import { credentialsProvider } from './auth.providers';

export const authConfig = {
  trustHost: true,
  providers: [credentialsProvider],
  session: { strategy: 'jwt' },
  cookies: {
    sessionToken: {
      name: `__Secure-authjs.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    csrfToken: {
      name: `__Host-authjs.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  callbacks: {
  },
} satisfies NextAuthConfig;
