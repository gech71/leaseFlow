import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';
import type { User, Role } from '@prisma/client';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        phoneNumber: { label: 'Phone Number', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.phoneNumber || !credentials.password) {
          return null;
        }

        const user = await prisma.user.findFirst({
          where: {
            phoneNumber: credentials.phoneNumber as string,
          },
          include: {
            roles: true,
          },
        });

        if (!user || !user.password) {
          return null;
        }
        
        const passwordsMatch = await bcrypt.compare(
          credentials.password as string,
          user.password,
        );

        if (passwordsMatch) {
            // Return a user object that is serializable
            return {
                id: user.id,
                name: user.name,
                email: user.email,
                phoneNumber: user.phoneNumber,
                roles: user.roles,
                tempPassword: user.tempPassword,
            };
        }

        return null;
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
        if (user) {
            // On sign in, `user` object is available.
            // Persist the data to the token.
            token.id = user.id;
            const dbUser = user as (User & { roles: Role[], tempPassword?: string | null });
            token.roles = dbUser.roles.map(role => role.name);
            const permissions = dbUser.roles.flatMap(role => role.permissions);
            token.permissions = [...new Set(permissions)]; // Make them unique
            token.tempPassword = dbUser.tempPassword;
        }
        return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        // Add custom properties to the session object
        session.user.id = token.id as string;
        session.user.roles = token.roles as string[];
        session.user.permissions = token.permissions as string[];
        session.user.tempPassword = token.tempPassword as string | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.AUTH_SECRET,
});
