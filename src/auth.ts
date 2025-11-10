
import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { databaseService } from '@/lib/services/databaseService';
import type { User as AuthUser } from 'next-auth';
import { SignJWT, jwtVerify } from 'jose';
import * as dotenv from 'dotenv';

dotenv.config(); // Load environment variables

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);

if (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET.length < 32) {
  throw new Error('NEXTAUTH_SECRET must be set and be at least 32 characters long.');
}

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
        session.user.id = token.id as string;
        session.user.roles = token.roles as any[]; // Type assertion for custom prop
        session.user.effectivePermissions = token.effectivePermissions as string[]; // Type assertion
        if (token.forceChangePass) {
          session.user.forceChangePass = true;
        }
      }
      return session;
    },
  },
  jwt: {
    // Override the default encode/decode to use standard signed JWTs (JWS)
    // instead of encrypted JWTs (JWE).
    async encode({ token, maxAge }) {
      return await new SignJWT(token!)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1d') // Set your desired expiration time
        .sign(secret);
    },
    async decode({ token }) {
      if (!token) {
        return null;
      }
      try {
        const { payload } = await jwtVerify(token, secret, {
          algorithms: ['HS256'],
        });
        return payload;
      } catch (error) {
        console.error("JWT Decode Error:", error);
        return null;
      }
    },
  },
});
