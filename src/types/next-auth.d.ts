import type { User as PrismaUser, Role as PrismaRole } from '@prisma/client';
import NextAuth, { type DefaultSession } from "next-auth"

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      /** The user's postal address. */
      id: string;
      roles: PrismaRole[];
      effectivePermissions: string[];
      firstName?: string | null;
      lastName?: string | null;
      phoneNumber?: string | null;
    } & DefaultSession["user"]
  }

  interface User {
      id: string;
      roles: PrismaRole[];
      effectivePermissions: string[];
      firstName?: string | null;
      lastName?: string | null;
      phoneNumber?: string | null;
  }
}

declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT {
    id: string;
    roles: PrismaRole[];
    effectivePermissions: string[];
    firstName?: string | null;
    lastName?: string | null;
    phoneNumber?: string | null;
  }
}