import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import type { User as AuthUser } from "next-auth";
import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);

if (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET.length < 32) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXTAUTH_SECRET must be set and be at least 32 characters long in production.",
    );
  } else {
    console.warn("WARN: NEXTAUTH_SECRET is not set.");
  }
}

const ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes in seconds
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,

  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      const now = Math.floor(Date.now() / 1000);

      // 1. Initial sign-in: Augment token with access/refresh details
      if (user) {
        token.id = user.id;
        token.accessTokenExp = now + ACCESS_TOKEN_EXPIRY;
        token.refreshTokenExp = now + REFRESH_TOKEN_EXPIRY;
        if ("forceChangePass" in user && user.forceChangePass) {
          token.forceChangePass = true;
        }
        return token;
      }
      
      // 2. On subsequent requests, check if access token is still valid
      if (now < (token.accessTokenExp as number)) {
        return token;
      }

      // 3. Access token has expired, check if refresh token is still valid
      if (now < (token.refreshTokenExp as number)) {
        // Issue a new access token (refresh the session)
        token.accessTokenExp = now + ACCESS_TOKEN_EXPIRY;
        return token;
      }

      // 4. Both access and refresh tokens have expired, end the session
      return {}; // Returning an empty object will invalidate the session
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        
        if (token.forceChangePass) {
          session.user.forceChangePass = true;
        } else {
          delete session.user.forceChangePass;
        }

        // Pass token expiry to the client session
        if (token.accessTokenExp) {
           session.expires = new Date((token.accessTokenExp as number) * 1000).toISOString();
        }

      } else {
        // This will effectively end the session if the token is invalid or has been expired by the jwt callback
        return null;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },
});
