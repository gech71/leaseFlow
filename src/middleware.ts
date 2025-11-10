import { auth } from "@/auth";
import { NextResponse, type NextRequest } from "next/server";

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' blob: data: https://i.imgur.com;
    font-src 'self' https://fonts.gstatic.com;
    media-src 'self';
    connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com;
    frame-src 'self' *.tinymce.com;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `;
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  // This header is set on the request so it can be read by Server Components.
  // The actual CSP header is set on the final response below.

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const isPortalChangePassPage = nextUrl.pathname === "/portal/change-password";

  if (isLoggedIn && req.auth?.user.forceChangePass) {
    if (!isPortalChangePassPage) {
      response = NextResponse.redirect(
        new URL("/portal/change-password", nextUrl),
      );
    }
  }

  if (isLoggedIn && !req.auth?.user.forceChangePass && isPortalChangePassPage) {
    response = NextResponse.redirect(new URL("/portal/dashboard", nextUrl));
  }

  if (nextUrl.pathname.startsWith("/admin") && !isLoggedIn) {
    response = NextResponse.redirect(new URL("/login", nextUrl));
  }

  if (
    nextUrl.pathname.startsWith("/portal/") &&
    !nextUrl.pathname.startsWith("/portal/connect") &&
    !isLoggedIn
  ) {
    response = NextResponse.redirect(new URL("/", nextUrl));
  }

  // Set security headers on the final response
  response.headers.set(
    "Content-Security-Policy",
    cspHeader.replace(/\s{2,}/g, " ").trim(),
  );
  response.headers.set("X-Content-Type-Options", "nosniff");

  return response;
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images (public images)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|images).*)",
  ],
};
