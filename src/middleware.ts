import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
 
// The `auth` middleware from NextAuth.js will handle session validation and redirection.
// It uses the `authorized` callback from `auth.config.ts`.
export default NextAuth(authConfig).auth;
 
export const config = {
  // https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
  // The matcher is used to run the Middleware on specific paths.
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
};
