
import { NextResponse, type NextRequest } from 'next/server';

const publicPaths = [
    "/login", 
    "/portal/connect", 
    "/api/portal/payment-callback",
    "/api/portal/Arifcallback",
    "/api/auth", // Allow all /api/auth routes, including our new session check
];

// This is a helper function to check authentication status by calling our internal API
async function isAuthenticated(request: NextRequest): Promise<boolean> {
  const sessionCookie = request.cookies.get('authjs.session-token');
  
  // If there's no session cookie, the user is definitely not logged in.
  if (!sessionCookie) {
    return false;
  }

  // Call the internal API to verify the session.
  // We must forward the cookie to the API route.
  const response = await fetch(new URL('/api/auth/session', request.url), {
    headers: {
      'Cookie': `${sessionCookie.name}=${sessionCookie.value}`
    }
  });

  // If the API returns a 200 OK status, the user is authenticated.
  return response.ok;
}


export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  const isPublic = publicPaths.some(path => pathname.startsWith(path));

  // --- Security Headers ---
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
  // --- End Security Headers ---

  const isLoggedIn = await isAuthenticated(request);
  
  if (isPublic) {
    if (isLoggedIn && pathname.startsWith('/login')) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
    // Always allow public paths
    return NextResponse.next({
      headers: responseHeaders,
    });
  }

  // If the path is not public and user is not logged in, redirect to login
  if (!isLoggedIn) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }
  
  // If user is logged in and at the root, redirect to the dashboard
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }
  
  // If everything is fine, proceed with the request
  return NextResponse.next({
    headers: responseHeaders,
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
