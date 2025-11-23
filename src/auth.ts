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

// Define token duration in seconds
const SESSION_DURATION_IN_SECONDS = 15 * 60; // 15 minutes

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

      // On initial sign-in, add user details to the token.
      if (user) {
        token.id = user.id;
        if ("forceChangePass" in user && user.forceChangePass) {
          token.forceChangePass = true;
        }
        return token;
      }

      // On subsequent requests, check if the token has expired.
      // The `exp` claim is automatically set by the `encode` function.
      if (token.exp && now > (token.exp as number)) {
        // If the token is expired, return an empty object to invalidate the session.
        return {};
      }

      // If the token is still valid, return it as is.
      return token;
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
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(`${SESSION_DURATION_IN_SECONDS}s`) // Set JWT to expire in 15 minutes
        .sign(secret);
    },
    async decode({ token }) {
      if (!token) {
        return null;
      }
      try {
        const { payload } = await jwtVerify(token, secret, {
          algorithms: ["HS256"],
        });
        return payload;
      } catch (error) {
        // This will be logged if the token is expired or invalid
        console.error("JWT Decode Error:", error);
        return null;
      }
    },
  },
  pages: {
    signIn: "/login",
    error: "/login", // Redirect users to login page on any error
  },
});
