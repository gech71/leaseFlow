import { withAuth, type NextRequestWithAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(request: NextRequestWithAuth) {
    const { pathname } = request.nextUrl;
    const token = request.nextauth.token;

    // Route protection logic
    const isPublicPath = pathname === "/login";

    // If user is logged in, redirect them from login page to dashboard
    if (token && isPublicPath) {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }

    // If user is not logged in and tries to access a protected route,
    // the `withAuth` default behavior will redirect them to the login page.
    
    // For all other cases (logged in user on protected route), allow the request.
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        const { pathname } = req.nextUrl;
        
        // The login page is always accessible
        if (pathname === "/login") {
            return true;
        }
        
        // For any other page, a token must exist.
        return !!token;
      },
    },
    // If you have a custom login page
    pages: {
      signIn: "/login",
    },
  }
);

// Define which routes are protected by the middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
