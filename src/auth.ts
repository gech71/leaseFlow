import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { databaseService } from '@/lib/services/databaseService';
import bcrypt from 'bcrypt';
import type { User as PrismaUser, Role as PrismaRole } from '@prisma/client';
import { z } from 'zod';

export const {
  handlers,
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsedCredentials = z
          .object({ phoneNumber: z.string(), password: z.string().min(6) })
          .safeParse(credentials);

        if (parsedCredentials.success) {
          const { phoneNumber, password } = parsedCredentials.data;
          
          const user = await databaseService.findUserByPhoneNumber(phoneNumber);
          if (!user || !user.password) return null;

          const passwordsMatch = await bcrypt.compare(password, user.password);

          if (passwordsMatch) {
            // On success, return only the user object with the id.
            // The rest of the data will be fetched in the `jwt` callback.
            return { id: user.id };
          }
        }
        
        console.log('Invalid credentials');
        return null;
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      // If `user` is present, this is the initial sign-in.
      if (user && user.id) {
         // Fetch full user profile from the database to enrich the token.
         const userWithRoles = await databaseService.getUserById(user.id, {
            roles: true,
         });
         
         if (userWithRoles) {
            // This is the correct place to build the token payload.
            const plainRoles = userWithRoles.roles.map(role => ({
                id: role.id,
                name: role.name,
                description: role.description,
                permissions: role.permissions,
            }));
            const effectivePermissions = Array.from(new Set(plainRoles.flatMap(r => r.permissions)));
            
            token.id = userWithRoles.id;
            token.roles = plainRoles as PrismaRole[];
            token.effectivePermissions = effectivePermissions;
            token.firstName = userWithRoles.firstName;
            token.lastName = userWithRoles.lastName;
            token.phoneNumber = userWithRoles.phoneNumber;
            token.name = userWithRoles.name;
            token.email = userWithRoles.email;
         }
      }
      return token;
    },
    async session({ session, token }) {
      // Pass the enriched data from the JWT to the client-side session object.
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
