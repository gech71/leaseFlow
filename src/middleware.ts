import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  // `withAuth` augments your `Request` with the user's token.
  function middleware(req) {
    const { token } = req.nextauth;
    const { pathname } = req.nextUrl;

    // If the user is logged in and tries to access the login page, redirect them.
    if (pathname.startsWith("/login") && token) {
      const url = req.nextUrl.clone();
      // Default redirect for logged-in users to the admin dashboard.
      // The layout will handle tenant vs. admin redirection from there.
      url.pathname = "/admin/dashboard"; 
      return NextResponse.redirect(url);
    }
  },
  {
    callbacks: {
      // This callback determines if the user is authorized to access a page.
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        
        // The login page is always accessible, even if not authenticated.
        if (pathname.startsWith('/login')) {
            return true;
        }
        
        // For any other page in the matcher, a token must exist (user must be logged in).
        return !!token;
      },
    },
    // If `authorized` returns false, the user is redirected to the login page.
    pages: {
        signIn: '/login',
    },
  }
);

// This config ensures the middleware runs on all protected routes and the login page.
// It excludes static assets and NextAuth's own API routes.
export const config = {
  matcher: [
    "/admin/:path*",
    "/portal/:path*",
    "/login",
  ],
};
