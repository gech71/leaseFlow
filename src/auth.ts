
import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { credentialsProvider } from './auth.providers';
import { databaseService } from '@/lib/services/databaseService';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: 'jwt' }, // Explicitly set JWT strategy
  providers: [credentialsProvider],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      // This is the first time the token is being created for this session (on sign-in)
      if (user) {
        token.id = user.id;
        token.forceChangePass = user.forceChangePass ?? false;
      }
      
      // On every JWT read, fetch the latest user data to keep session fresh.
      // This is a good place to update roles/permissions if they change.
      if (token.id) {
         const fullUser = await databaseService.getUserById(token.id as string, {
          roles: true,
        });

        if (fullUser) {
          const plainRoles = fullUser.roles.map(role => ({
            id: role.id,
            name: role.name,
            description: role.description,
            permissions: role.permissions,
            createdById: role.createdById,
            createdAt: role.createdAt,
            updatedAt: role.updatedAt,
          }));

          const effectivePermissions = Array.from(
            new Set(plainRoles.flatMap(r => r.permissions))
          );

          token.roles = plainRoles;
          token.effectivePermissions = effectivePermissions;
          token.firstName = fullUser.firstName;
          token.lastName = fullUser.lastName;
          token.phoneNumber = fullUser.phoneNumber;
          token.name = fullUser.name;
          token.email = fullUser.email;
        } else {
            // User not found, invalidate the token
            return {};
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.roles = token.roles as any[];
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
