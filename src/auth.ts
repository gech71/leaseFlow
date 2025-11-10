
import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import type { User as AuthUser } from 'next-auth';
import { SignJWT, jwtVerify } from 'jose';

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
      
      // If both tokens are expired, the user will be forced to log in again.
      // Returning an empty object effectively invalidates the session.
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
  // next-auth v5 automatically uses process.env.AUTH_SECRET, so we don't need to manually handle it here.
  // The secret option is only needed if you are using a different environment variable.
});
