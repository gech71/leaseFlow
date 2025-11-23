
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { databaseService } from "./lib/services/databaseService";

const ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes in seconds
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,

  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      const now = Math.floor(Date.now() / 1000);

      // Initial sign-in or session update
      if (user) {
        token.id = user.id;
        token.accessTokenExp = now + ACCESS_TOKEN_EXPIRY;
        token.refreshTokenExp = now + REFRESH_TOKEN_EXPIRY;
        
        const dbUser = await databaseService.getUserById(user.id, { roles: true });
        if (dbUser) {
            const isSuperAdmin = dbUser.roles.some(role => role.name === 'SUPER_ADMIN');
            const permissions = new Set<string>();
            if (!isSuperAdmin) {
                dbUser.roles.forEach(role => {
                    role.permissions.forEach(permission => permissions.add(permission));
                });
            }
            token.permissions = Array.from(permissions);
            token.isSuperAdmin = isSuperAdmin;
        }

        if ("forceChangePass" in user && user.forceChangePass) {
          token.forceChangePass = true;
        } else {
          delete token.forceChangePass;
        }
        return token;
      }
      
      // On subsequent requests, check if access token is still valid
      if (now < (token.accessTokenExp as number)) {
        return token;
      }

      // Access token has expired, check if refresh token is still valid
      if (now < (token.refreshTokenExp as number)) {
        // Issue a new access token (refresh the session)
        token.accessTokenExp = now + ACCESS_TOKEN_EXPIRY;
        return token;
      }

      // Both access and refresh tokens have expired, end the session
      return {}; 
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        
        session.user.isSuperAdmin = token.isSuperAdmin as boolean;
        session.user.permissions = token.permissions as string[];

        if (token.forceChangePass) {
          session.user.forceChangePass = true;
        } else {
          if ('forceChangePass' in session.user) {
            delete session.user.forceChangePass;
          }
        }

        if (token.accessTokenExp) {
           session.expires = new Date((token.accessTokenExp as number) * 1000).toISOString();
        }

      } else {
        return null;
      }
      return session;
    },
  },
});
