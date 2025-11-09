
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { databaseService } from '@/lib/services/databaseService';
import bcrypt from 'bcrypt';
import type { User as PrismaUser, Role as PrismaRole } from '@prisma/client';
import { z } from 'zod';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsedCredentials = z
          .object({ phoneNumber: z.string(), password: z.string().min(1) })
          .safeParse(credentials);

        if (parsedCredentials.success) {
          const { phoneNumber, password } = parsedCredentials.data;
          
          const user = await databaseService.findUserByPhoneNumber(phoneNumber);
          if (!user || !user.password) return null;

          const passwordsMatch = await bcrypt.compare(password, user.password);

          if (passwordsMatch) {
            // Check if it's a temporary password login
            if (user.tempPassword) {
              const error = new Error(JSON.stringify({ code: "PASSWORD_CHANGE_REQUIRED", message: "User must change their password." }));
              // This special error is caught by the sign-in page to trigger a redirect.
              throw error;
            }
            return { id: user.id, name: user.name, email: user.email };
          }
        }
        
        return null;
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      // If `user` is present, it's the initial sign-in.
      if (user && user.id) {
        const fullUser = await databaseService.getUserById(user.id, {
          roles: true,
        });

        if (fullUser) {
          const plainRoles = fullUser.roles.map(role => ({
            id: role.id,
            name: role.name,
            description: role.description,
            permissions: role.permissions,
            createdAt: role.createdAt.toISOString(),
            updatedAt: role.updatedAt.toISOString(),
            createdById: role.createdById
          }));

          const effectivePermissions = Array.from(
            new Set(plainRoles.flatMap(r => r.permissions))
          );

          token.id = fullUser.id;
          token.roles = plainRoles;
          token.effectivePermissions = effectivePermissions;
          token.firstName = fullUser.firstName;
          token.lastName = fullUser.lastName;
          token.phoneNumber = fullUser.phoneNumber;
          token.name = fullUser.name;
          token.email = fullUser.email;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.roles = token.roles as PrismaRole[];
        session.user.effectivePermissions = token.effectivePermissions as string[];
        session.user.firstName = token.firstName as string | null;
        session.user.lastName = token.lastName as string | null;
        session.user.phoneNumber = token.phoneNumber as string | null;
        session.user.name = token.name as string | null;
        session.user.email = token.email as string | null;
      }
      return session;
    },
  },
});
