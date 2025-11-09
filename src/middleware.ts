
import withAuth from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  // `withAuth` augments your `Request` with the user's token.
  function middleware(req) {
    const { token } = req.nextauth;
    const { pathname } = req.nextUrl;

    const isAuthPage = pathname.startsWith("/login");

    // If the user is logged in and tries to access the login page, redirect them.
    if (isAuthPage && token) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/dashboard"; // Default redirect for logged-in users
      return NextResponse.redirect(url);
    }
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        
        // If they are trying to access the login page, let them.
        if (pathname.startsWith('/login')) {
            return true;
        }
        
        // For any other page, a token must exist (user must be logged in).
        return !!token;
      },
    },
    pages: {
        signIn: '/login', // Redirect here if `authorized` returns false
    },
  }
);

// This config ensures the middleware runs on all admin/portal paths, and also on the login page.
// It excludes static assets and NextAuth's internal API routes.
export const config = {
  matcher: [
    "/admin/:path*",
    "/portal/:path*",
    "/login",
  ],
};
