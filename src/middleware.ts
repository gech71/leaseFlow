import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

// The `auth` middleware from NextAuth.js will handle session validation and redirection.
// It uses the `authorized` callback from `auth.config.ts`.
export default NextAuth(authConfig).auth;

export const config = {
  // The matcher is used to run the Middleware on specific paths.
  // This ensures API routes for auth are not intercepted by the middleware.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
};
