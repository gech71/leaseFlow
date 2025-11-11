import { auth } from "@/auth";
import { NextResponse, type NextRequest } from "next/server";

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  // Generate nonce for any inline scripts
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' https://cdn.tiny.cloud blob:;
    style-src 'self' 'unsafe-inline' https://cdn.tiny.cloud https://fonts.googleapis.com;
    img-src 'self' blob: data: https://cdn.tiny.cloud;
    font-src 'self' https://fonts.gstatic.com;
    connect-src 'self' https://cdn.tiny.cloud https://*.tinymce.com;
    frame-src 'self' https://cdn.tiny.cloud https://*.tinymce.com;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `;

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set(
    "Content-Security-Policy",
    cspHeader.replace(/\s{2,}/g, " ").trim(),
  );

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const isPortalChangePassPage = nextUrl.pathname === "/portal/change-password";
  if (isLoggedIn && req.auth?.user.forceChangePass && !isPortalChangePassPage) {
    response = NextResponse.redirect(
      new URL("/portal/change-password", nextUrl),
    );
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

  const finalHeaders = new Headers(response.headers);
  finalHeaders.set(
    "Content-Security-Policy",
    cspHeader.replace(/\s{2,}/g, " ").trim(),
  );

  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: finalHeaders,
  });
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|images).*)"],
};
