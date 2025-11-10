import { auth } from "@/auth";
import { NextResponse, type NextRequest } from "next/server";

export default auth((req: NextRequest) => {
  // ✅ Fix the type issue
  const request = req as any;

  const { nextUrl } = request;
  const isLoggedIn = !!request.auth;

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' *.tinymce.com;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com *.tinymce.com;
    img-src 'self' blob: data: https://i.imgur.com;
    font-src 'self' https://fonts.gstatic.com;
    connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com;
    frame-src 'self' *.tinymce.com;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `
    .replace(/\s{2,}/g, " ")
    .trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const isPortalChangePassPage = nextUrl.pathname === "/portal/change-password";

  if (
    isLoggedIn &&
    request.auth?.user.forceChangePass &&
    !isPortalChangePassPage
  ) {
    response = NextResponse.redirect(
      new URL("/portal/change-password", nextUrl),
      {
        headers: requestHeaders,
      },
    );
  }

  if (
    isLoggedIn &&
    !request.auth?.user.forceChangePass &&
    isPortalChangePassPage
  ) {
    response = NextResponse.redirect(new URL("/portal/dashboard", nextUrl), {
      headers: requestHeaders,
    });
  }

  if (nextUrl.pathname.startsWith("/admin") && !isLoggedIn) {
    response = NextResponse.redirect(new URL("/login", nextUrl), {
      headers: requestHeaders,
    });
  }

  if (
    nextUrl.pathname.startsWith("/portal/") &&
    !nextUrl.pathname.startsWith("/portal/connect") &&
    !isLoggedIn
  ) {
    response = NextResponse.redirect(new URL("/", nextUrl), {
      headers: requestHeaders,
    });
  }

  response.headers.set("x-nonce", nonce);
  response.headers.set("Content-Security-Policy", cspHeader);
  response.headers.set("X-Content-Type-Options", "nosniff");

  return response;
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|images).*)"],
};
