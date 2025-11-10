
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  const isPortalChangePassPage = nextUrl.pathname === "/portal/change-password";

  if (isLoggedIn && req.auth?.user.forceChangePass) {
    // If a password change is forced and the user is NOT on the change password page,
    // redirect them there.
    if (!isPortalChangePassPage) {
      return NextResponse.redirect(new URL("/portal/change-password", nextUrl));
    }
    // If they are on the change password page, allow the request to proceed.
    return NextResponse.next();
  }

  // If the user is logged in, does NOT need to change their password, but tries
  // to access the change password page, redirect them away to their dashboard.
  if (isLoggedIn && !req.auth?.user.forceChangePass && isPortalChangePassPage) {
    return NextResponse.redirect(new URL("/portal/dashboard", nextUrl));
  }

  // Redirect unauthenticated users trying to access protected admin routes
  if (nextUrl.pathname.startsWith("/admin") && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }
  
  // Redirect unauthenticated users trying to access protected portal routes
  // (except for the connection page which handles its own auth)
  if (nextUrl.pathname.startsWith("/portal/") && !nextUrl.pathname.startsWith("/portal/connect") && !isPortalChangePassPage && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }


  return NextResponse.next();
});

// This config ensures the middleware runs on all admin and portal routes,
// but excludes asset/API calls and the public login page itself to prevent redirect loops.
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - login (the login page itself)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|images|login).*)',
  ],
};
