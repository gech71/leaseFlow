
import type { DefaultSession, User } from 'next-auth';
import type { JWT } from 'next-auth/jwt';

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    roles: string[];
    permissions: string[];
    tempPassword?: string;
    firstName?: string | null;
    lastName?: string | null;
    phoneNumber?: string | null;
  }
}

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      roles: string[];
      permissions: string[];
      tempPassword?: string;
      firstName?: string | null;
      lastName?: string | null;
      phoneNumber?: string | null;
    } & DefaultSession['user'];
  }

   interface User {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      phoneNumber?: string | null;
      roles: import('@prisma/client').Role[];
      tempPassword?: string | null;
   }
}
