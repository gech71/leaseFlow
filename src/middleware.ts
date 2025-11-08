
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  // `withAuth` augments your `Request` with the user's token.
  function middleware(req) {
    const { token } = req.nextauth;
    const { pathname } = req.nextUrl;

    const isAuthPage = pathname === "/login";
    
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
        
        // Login page is always accessible, even if not logged in.
        if (pathname === '/login') {
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

// This config ensures the middleware runs on all paths EXCEPT for NextAuth's internal API routes and static assets.
export const config = {
  matcher: [
    "/((?!api/auth/|login|_next/static|_next/image|favicon.ico|.*\\.png$).*)",
    "/admin/:path*",
    "/portal/:path*",
  ],
};
