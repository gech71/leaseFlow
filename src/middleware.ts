import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  const isPortalChangePassPage = nextUrl.pathname === "/portal/change-password";

  if (isLoggedIn && req.auth?.user.forceChangePass) {
    if (!isPortalChangePassPage) {
      return NextResponse.redirect(new URL("/portal/change-password", nextUrl));
    }
    return NextResponse.next();
  }

  if (isLoggedIn && !req.auth?.user.forceChangePass && isPortalChangePassPage) {
    return NextResponse.redirect(new URL("/portal/dashboard", nextUrl));
  }

  // Redirect unauthenticated users trying to access protected admin routes
  if (nextUrl.pathname.startsWith("/admin") && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/admin/:path*",
    "/portal/:path*",
    // Exclude NextAuth, assets, icons, images, API routes
    "/((?!api|auth|login).*)",
  ],
};
