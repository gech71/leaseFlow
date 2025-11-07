
import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { databaseService } from "@/lib/services/databaseService";
import bcrypt from "bcrypt";
import type { User as PrismaUser, Role as PrismaRole } from '@prisma/client';
import type { User, Session } from 'next-auth';

// Extend the User and Session types from next-auth
declare module 'next-auth' {
  interface User {
    id: string;
    roles: PrismaRole[];
    effectivePermissions: string[];
    firstName?: string | null;
    lastName?: string | null;
    phoneNumber?: string | null;
  }
  interface Session {
    user: User;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    roles: PrismaRole[];
    effectivePermissions: string[];
    firstName?: string | null;
    lastName?: string | null;
    phoneNumber?: string | null;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        phoneNumber: { label: "Phone Number", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.phoneNumber || !credentials.password) {
          return null;
        }

        const user = await databaseService.findUserByPhoneNumber(credentials.phoneNumber, {
          roles: true,
        });

        if (!user || !user.password) {
          // User not found or has no password set
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }

        // Return a simplified user object. The JWT callback will enrich it.
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          roles: user.roles, // Pass roles to be used in JWT callback
          firstName: user.firstName,
          lastName: user.lastName,
          phoneNumber: user.phoneNumber,
          effectivePermissions: [], // This will be populated in the JWT callback
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      // On sign in, `user` object is available from the authorize function
      if (user) {
        token.id = user.id;
        token.roles = user.roles;
        // Calculate and add effectivePermissions here
        token.effectivePermissions = Array.from(
          new Set(user.roles.flatMap((r) => r.permissions))
        );
        token.firstName = user.firstName;
        token.lastName = user.lastName;
        token.phoneNumber = user.phoneNumber;
      }
      return token;
    },
    async session({ session, token }) {
      // Pass info from the JWT to the session object
      if (token && session.user) {
        session.user.id = token.id;
        session.user.roles = token.roles;
        session.user.effectivePermissions = token.effectivePermissions;
        session.user.firstName = token.firstName;
        session.user.lastName = token.lastName;
        session.user.phoneNumber = token.phoneNumber;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    // error: '/auth/error', // (optional)
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
