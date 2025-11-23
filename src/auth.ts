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

const SESSION_DURATION_IN_SECONDS = 15 * 60; // 15 minutes

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,

  cookies: {
    sessionToken: {
      name: "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production", // Secure cookie in production
      },
    },
  },

  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      const now = Math.floor(Date.now() / 1000);

      if (user) {
        token.id = user.id;
        if ("forceChangePass" in user && user.forceChangePass) {
          token.forceChangePass = true;
        }
        return token;
      }

      if (token.exp && now > (token.exp as number)) {
        return {};
      }

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
        return null;
      }
      return session;
    },
  },

  jwt: {
    async encode({ token }) {
      return await new SignJWT(token!)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(`${SESSION_DURATION_IN_SECONDS}s`)
        .sign(secret);
    },
    async decode({ token }) {
      if (!token) return null;
      try {
        const { payload } = await jwtVerify(token, secret, {
          algorithms: ["HS256"],
        });
        return payload;
      } catch (error) {
        console.error("JWT Decode Error:", error);
        return null;
      }
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },
});
