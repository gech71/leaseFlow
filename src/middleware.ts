
import { auth } from "@/auth";
import { NextResponse, type NextRequest } from "next/server";

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  const isPortalChangePassPage = nextUrl.pathname === "/portal/change-password";
  const isAdminPath = nextUrl.pathname.startsWith("/admin");
  const isPortalPath = nextUrl.pathname.startsWith("/portal/");
  const isConnectPath = nextUrl.pathname.startsWith("/portal/connect");

  // Check for force password change immediately after checking login status
  if (isLoggedIn && req.auth?.user.forceChangePass && !isPortalChangePassPage) {
    // Redirect to the change password page if the flag is set and they are not already there
    return NextResponse.redirect(new URL("/portal/change-password", nextUrl));
  }

  // If user is on the change password page but doesn't need to be, redirect them away.
  if (isLoggedIn && !req.auth?.user.forceChangePass && isPortalChangePassPage) {
    return NextResponse.redirect(new URL("/portal/dashboard", nextUrl));
  }

  // Protect admin routes
  if (isAdminPath && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // Protect portal routes (excluding the entry point)
  if (isPortalPath && !isConnectPath && !isLoggedIn) {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  // For all other cases, proceed with the request
  const response = NextResponse.next();
  return response;
});

// Matcher to run the middleware on all routes except for static assets and API routes.
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|images).*)"],
};
