
import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { credentialsProvider } from './auth.providers';
import { databaseService } from '@/lib/services/databaseService';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [credentialsProvider],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        // This is the first time the token is being created for this session
        token.id = user.id;
        // Correctly carry over the forceChangePass flag from the authorize user object
        token.forceChangePass = user.forceChangePass ?? false;

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
        session.user.roles = token.roles as any[];
        session.user.effectivePermissions = token.effectivePermissions as string[];
        session.user.firstName = token.firstName as string | null;
        session.user.lastName = token.lastName as string | null;
        session.user.phoneNumber = token.phoneNumber as string | null;
        session.user.name = token.name as string | null;
        session.user.email = token.email as string | null;
        // Ensure the flag is passed from the token to the final session object
        session.user.forceChangePass = (token.forceChangePass as boolean | undefined) ?? false;
      }
      return session;
    },
  },
});
