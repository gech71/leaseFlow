import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { databaseService } from '@/lib/services/databaseService';

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      // On initial sign-in, attach user data to the token
      if (user) {
        token.id = user.id;
        
        // Refetch user with roles to ensure token is fresh
        const userWithRoles = await databaseService.getUserById(user.id, { roles: true });
        if (userWithRoles && userWithRoles.roles) {
          const effectivePermissions = new Set<string>();
          userWithRoles.roles.forEach(role => {
            role.permissions.forEach(p => effectivePermissions.add(p));
          });
          
          token.roles = userWithRoles.roles;
          token.effectivePermissions = Array.from(effectivePermissions);
        } else {
          token.roles = [];
          token.effectivePermissions = [];
        }

        // Pass the forceChangePass flag to the token
        if ('forceChangePass' in user && user.forceChangePass) {
          token.forceChangePass = true;
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Attach the custom data from the token to the session object
      if (session.user) {
        session.user.id = token.id;
        session.user.roles = token.roles;
        session.user.effectivePermissions = token.effectivePermissions;
        if (token.forceChangePass) {
          session.user.forceChangePass = true;
        }
      }
      return session;
    },
  },
});
