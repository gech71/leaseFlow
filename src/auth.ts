
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import bcryptjs from 'bcryptjs';
import type { User as PrismaUser, Role as PrismaRole } from '@prisma/client';
import { z } from 'zod';

// Define a custom user type for what the authorize callback should return.
// It MUST be a simple object, not a complex Prisma model.
interface AuthorizeUser {
  id: string;
  name: string | null;
  email: string | null;
  forceChangePass?: boolean;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    Credentials({
      async authorize(credentials): Promise<AuthorizeUser | null> {
        // Dynamically import here to keep prisma out of the edge runtime
        const { databaseService } = await import('@/lib/services/databaseService');

        const parsedCredentials = z
          .object({ phoneNumber: z.string(), password: z.string().min(1) })
          .safeParse(credentials);

        if (parsedCredentials.success) {
          const { phoneNumber, password } = parsedCredentials.data;
          
          const user = await databaseService.findUserByPhoneNumber(phoneNumber);
          if (!user) return null; // User not found

          // Handle temporary password login (when password is null but tempPassword is set)
          if (user.password === null && user.tempPassword) {
            if (password === user.tempPassword) {
              return { id: user.id, name: user.name, email: user.email, forceChangePass: true };
            } else {
              return null; // Incorrect temp password
            }
          }

          // Handle regular password login
          if (user.password) {
            const passwordsMatch = await bcryptjs.compare(password, user.password);
            if (passwordsMatch) {
              return { id: user.id, name: user.name, email: user.email };
            }
          }
        }
        
        return null; // Return null if credentials are not valid for any case
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        // `user` here is the simple object from the `authorize` callback.
        const authUser = user as AuthorizeUser;
        
        // This is the first time the token is being created for this session
        token.id = authUser.id;
        token.forceChangePass = authUser.forceChangePass ?? false;

        // Now, fetch the full user details from the database to enrich the token
        // Dynamically import here to keep prisma out of the edge runtime
        const { databaseService } = await import('@/lib/services/databaseService');
        const fullUser = await databaseService.getUserById(authUser.id, {
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
