
import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import type { User as AuthUser } from 'next-auth';
import { SignJWT, jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);

if (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET.length < 32) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('NEXTAUTH_SECRET must be set and be at least 32 characters long in production.');
  } else {
    console.warn('NEXTAUTH_SECRET is not set.');
  }
}

// Define token durations in seconds
const ACCESS_TOKEN_EXPIRES_IN = 15 * 60; // 15 minutes
const REFRESH_TOKEN_EXPIRES_IN = 7 * 24 * 60 * 60; // 7 days

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
      const now = Math.floor(Date.now() / 1000);

      // On initial sign-in, set up both access and refresh tokens
      if (user) {
        token.id = user.id;
        token.accessTokenExp = now + ACCESS_TOKEN_EXPIRES_IN;
        token.refreshTokenExp = now + REFRESH_TOKEN_EXPIRES_IN;
        
        if ('forceChangePass' in user && user.forceChangePass) {
          token.forceChangePass = true;
        } else {
          delete token.forceChangePass;
        }
        return token;
      }
      
      // If the access token has not expired, return the current token
      if (token.accessTokenExp && now < (token.accessTokenExp as number)) {
        return token;
      }

      // If the access token has expired, but the refresh token is still valid, refresh the access token
      if (token.refreshTokenExp && now < (token.refreshTokenExp as number)) {
        token.accessTokenExp = now + ACCESS_TOKEN_EXPIRES_IN;
        return token; // Return the token with a new access token expiration
      }
      
      return {};
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        if (token.forceChangePass) {
          session.user.forceChangePass = true;
        } else {
          delete session.user.forceChangePass;
        }
      } else {
        // If token is empty (due to expiration), invalidate the session
        return null;
      }
      return session;
    },
  },
  jwt: {
    async encode({ token, maxAge }) {
      return await new SignJWT(token!)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(`${REFRESH_TOKEN_EXPIRES_IN}s`) // Set JWT to expire with the refresh token
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
