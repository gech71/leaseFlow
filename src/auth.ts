import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { databaseService } from '@/lib/services/databaseService';
import bcrypt from 'bcrypt';
import type { User as PrismaUser, Role as PrismaRole } from '@prisma/client';

export const { 
  handlers: { GET, POST }, 
  auth, 
  signIn, 
  signOut 
} = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        if (!credentials?.phoneNumber || !credentials.password) {
          return null;
        }

        const { phoneNumber, password } = credentials;

        const user = await databaseService.findUserByPhoneNumber(
          phoneNumber as string,
          {
            roles: true,
          }
        );

        if (!user || !user.password) {
          return null;
        }

        const passwordsMatch = await bcrypt.compare(
          password as string,
          user.password
        );

        if (passwordsMatch) {
            // Return a plain object, ensuring it's serializable.
            return {
                id: user.id,
                name: user.name,
                email: user.email,
                roles: user.roles,
                firstName: user.firstName,
                lastName: user.lastName,
                phoneNumber: user.phoneNumber
            };
        }

        return null;
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
        if (user) {
            // On sign-in, the user object is available. Persist the data to the token.
            token.id = user.id;
            const userWithRoles = user as (PrismaUser & { roles: PrismaRole[] });
            token.roles = userWithRoles.roles;
            token.effectivePermissions = Array.from(new Set(userWithRoles.roles.flatMap(r => r.permissions)));
            token.firstName = userWithRoles.firstName;
            token.lastName = userWithRoles.lastName;
            token.phoneNumber = userWithRoles.phoneNumber;
        }
        return token;
    },
    async session({ session, token }) {
        // Pass info from the JWT to the session object
        if (token && session.user) {
            session.user.id = token.id as string;
            session.user.roles = token.roles as PrismaRole[];
            session.user.effectivePermissions = token.effectivePermissions as string[];
            session.user.firstName = token.firstName as string;
            session.user.lastName = token.lastName as string;
            session.user.phoneNumber = token.phoneNumber as string;
        }
        return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.AUTH_SECRET,
});