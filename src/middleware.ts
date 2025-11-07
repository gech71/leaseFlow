
import { auth } from '@/lib/auth';
import { NextResponse, type NextRequest } from 'next/server';

const publicPaths = [
    "/login", 
    "/portal/connect", 
    "/api/portal/payment-callback",
    "/api/portal/Arifcallback",
    "/api/auth",
];

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const isLoggedIn = !!request.auth;

  const isPublic = publicPaths.some(path => pathname.startsWith(path));

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${process.env.NODE_ENV === "development" ? "'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.tiny.cloud;
    img-src 'self' data: blob: https://picsum.photos https://i.imgur.com;
    font-src 'self' https://fonts.gstatic.com https://cdn.tiny.cloud;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    block-all-mixed-content;
    upgrade-insecure-requests;
    connect-src 'self' https://generativelanguage.googleapis.com https://cdn.tiny.cloud;
    worker-src 'self' blob:;
    frame-src 'self' blob:;
  `.replace(/\s{2,}/g, " ").trim();

  const responseHeaders = new Headers(request.headers);
  responseHeaders.set('x-nonce', nonce);
  responseHeaders.set('Content-Security-Policy', cspHeader);
  responseHeaders.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  responseHeaders.set("X-Content-Type-Options", "nosniff");
  responseHeaders.set("X-Frame-Options", "SAMEORIGIN");
  responseHeaders.set("X-XSS-Protection", "1; mode=block");
  responseHeaders.set("Referrer-Policy", "strict-origin-when-cross-origin");
  responseHeaders.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  responseHeaders.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  responseHeaders.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  responseHeaders.set("Pragma", "no-cache");
  
  if (isPublic) {
    if (isLoggedIn && pathname.startsWith('/login')) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
    return NextResponse.next({
      headers: responseHeaders,
    });
  }

  if (!isLoggedIn) {
    const url = new URL('/login', request.url);
    url.searchParams.set('callbackUrl', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }

  return NextResponse.next({
    headers: responseHeaders,
  });
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
