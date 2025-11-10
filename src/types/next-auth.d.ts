
import type { User as PrismaUser, Role } from '@prisma/client';
import type { DefaultSession, User as NextAuthUser } from 'next-auth';
import type { JWT as NextAuthJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface User extends Omit<PrismaUser, 'password' | 'tempPassword' | 'emailVerified'> {
    // Add custom properties here, if any
  }

  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      effectivePermissions: string[];
      forceChangePass?: boolean;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends NextAuthJWT {
    id: string;
    effectivePermissions: string[];
    forceChangePass?: boolean;
  }
}
