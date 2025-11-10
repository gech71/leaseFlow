
import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { databaseService } from '@/lib/services/databaseService';
import type { User as AuthUser } from 'next-auth';
import { SignJWT, jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);

if (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET.length < 32) {
  // This check is important for security.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('NEXTAUTH_SECRET must be set and be at least 32 characters long in production.');
  } else {
    console.warn('WARN: NEXTAUTH_SECRET is not set or is not long enough. This is not secure for production.');
  }
}


export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        // Pass the forceChangePass flag from the user object to the token
        if ('forceChangePass' in user && user.forceChangePass) {
          token.forceChangePass = true;
        } else {
          // Ensure the flag is not present if not applicable
          delete token.forceChangePass;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        // Correctly carry over the flag from the token to the session
        if (token.forceChangePass) {
          session.user.forceChangePass = true;
        } else {
          delete session.user.forceChangePass;
        }
      }
      return session;
    },
  },
  jwt: {
    // Override the default encode/decode to use standard signed JWTs (JWS)
    // instead of encrypted JWTs (JWE).
    async encode({ token, maxAge }) {
      return await new SignJWT(token!)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1d') // Set your desired expiration time
        .sign(secret);
    },
    async decode({ token }) {
      if (!token) {
        return null;
      }
      try {
        const { payload } = await jwtVerify(token, secret, {
          algorithms: ['HS256'],
        });
        return payload;
      } catch (error) {
        console.error("JWT Decode Error:", error);
        return null;
      }
    },
  },
});
