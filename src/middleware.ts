
import { auth } from "@/auth";
import { NextResponse, type NextRequest } from "next/server";

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval' *.tinymce.com;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com *.tinymce.com;
    img-src 'self' blob: data: ;
    font-src 'self' https://fonts.gstatic.com *.tinymce.com;
    connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com *.tinymce.com;
    frame-src 'self' *.tinymce.com;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `;
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const isPortalChangePassPage = nextUrl.pathname === "/portal/change-password";

  if (isLoggedIn && req.auth?.user.forceChangePass) {
    if (!isPortalChangePassPage) {
      response = NextResponse.redirect(new URL("/portal/change-password", nextUrl));
    }
  }

  if (isLoggedIn && !req.auth?.user.forceChangePass && isPortalChangePassPage) {
    response = NextResponse.redirect(new URL("/portal/dashboard", nextUrl));
  }

  if (nextUrl.pathname.startsWith("/admin") && !isLoggedIn) {
    response = NextResponse.redirect(new URL("/login", nextUrl));
  }
  
  if (nextUrl.pathname.startsWith("/portal/") && !nextUrl.pathname.startsWith("/portal/connect") && !isLoggedIn) {
    response = NextResponse.redirect(new URL("/", nextUrl));
  }

  response.headers.set('Content-Security-Policy', cspHeader.replace(/\s{2,}/g, ' ').trim());

  return response;
});

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|images).*)',
  ],
};
