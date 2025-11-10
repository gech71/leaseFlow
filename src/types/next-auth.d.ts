
import type { User as PrismaUser, Role } from '@prisma/client';
import type { DefaultSession, User as NextAuthUser } from 'next-auth';
import type { JWT as NextAuthJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface User extends Omit<PrismaUser, 'password' | 'tempPassword' | 'emailVerified'> {
    forceChangePass?: boolean;
  }

  interface Session {
    user: {
      id: string;
      forceChangePass?: boolean;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends NextAuthJWT {
    id?: string; // ID is optional during certain token operations
    forceChangePass?: boolean;
  }
}
