
import NextAuth from 'next-auth';
import { CredentialsSignin } from "next-auth";
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { databaseService } from '@/lib/services/databaseService';
import bcrypt from 'bcryptjs';
import type { User as PrismaUser, Role as PrismaRole } from '@prisma/client';
import { z } from 'zod';

// Define a custom user type for the authorize callback
interface AuthorizeUser {
  id: string;
  name: string | null;
  email: string | null;
  requiresPasswordChange?: boolean;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    Credentials({
      async authorize(credentials): Promise<AuthorizeUser | null> {
        const parsedCredentials = z
          .object({ phoneNumber: z.string(), password: z.string().min(1) })
          .safeParse(credentials);

        if (parsedCredentials.success) {
          const { phoneNumber, password } = parsedCredentials.data;
          
          const user = await databaseService.findUserByPhoneNumber(phoneNumber);
          if (!user) return null; // User not found

          // Handle temporary password login
          if (user.password === null && user.tempPassword) {
            if (password === user.tempPassword) {
              // On successful temp password login, indicate a password change is required.
              throw new CredentialsSignin("User must change their password.", { code: "PASSWORD_CHANGE_REQUIRED" });
            } else {
              return null; // Incorrect temp password
            }
          }

          // Handle regular password login
          if (user.password) {
            const passwordsMatch = await bcrypt.compare(password, user.password);
            if (passwordsMatch) {
              // Return a standard user object
              return { id: user.id, name: user.name, email: user.email };
            }
          }
        }
        
        return null; // Return null if credentials are not valid
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      // If `user` is present, it's the initial sign-in.
      if (user) {
        // Handle the custom flag from the authorize callback
        const authUser = user as AuthorizeUser;
        if (authUser.requiresPasswordChange) {
            token.forceChangePass = true;
        }

        const fullUser = await databaseService.getUserById(user.id, {
          roles: true,
        });

        if (fullUser) {
          const plainRoles = fullUser.roles.map(role => ({
            id: role.id,
            name: role.name,
            description: role.description,
            permissions: role.permissions,
          }));

          const effectivePermissions = Array.from(
            new Set(plainRoles.flatMap(r => r.permissions))
          );

          token.id = fullUser.id;
          token.roles = plainRoles as any;
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
        session.user.forceChangePass = (token.forceChangePass as boolean | undefined) ?? false;
      }
      return session;
    },
  },
});
