
import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // Carry over the forceChangePass flag from the authorize step to the JWT
        if (user.forceChangePass) {
          token.forceChangePass = true;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
      }
      // Carry over the flag from the JWT to the final session object
      if (token.forceChangePass && session.user) {
        session.user.forceChangePass = true;
      }
      return session;
    },
  },
});
