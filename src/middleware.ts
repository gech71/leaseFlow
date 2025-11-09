import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

// The `auth` middleware from NextAuth.js will handle session validation and redirection.
// It uses the `authorized` callback from `auth.config.ts`.
export default NextAuth(authConfig).auth;

export const config = {
  // The matcher is used to run the Middleware on specific paths.
  // This configuration protects all admin and portal routes.
  matcher: ['/admin/:path*', '/portal/:path*'],
};
