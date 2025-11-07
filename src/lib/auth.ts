
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
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }
        
        const effectivePermissions = Array.from(new Set(user.roles.flatMap(r => r.permissions)));

        // Return a plain object to ensure serializability
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          roles: user.roles,
          effectivePermissions: effectivePermissions,
          firstName: user.firstName,
          lastName: user.lastName,
          phoneNumber: user.phoneNumber,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      // On sign in, `user` object is the plain object from `authorize`
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.roles = user.roles;
        token.effectivePermissions = user.effectivePermissions;
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
        session.user.name = token.name;
        session.user.email = token.email;
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
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
