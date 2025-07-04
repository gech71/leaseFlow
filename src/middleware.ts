
import { NextResponse, type NextRequest } from 'next/server';

const ACCESS_TOKEN_KEY = 'leaseflow_access_token';
const ADMIN_DASHBOARD_PATH = '/admin/dashboard';
const ADMIN_LOGIN_PATH = '/auth/login';
const PORTAL_LOGIN_PATH = '/portal/login';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get(ACCESS_TOKEN_KEY)?.value;

  // Define paths that are always public or have their own auth logic
  const publicApiPaths = [
    '/api/auth/login',
    '/api/auth/logout',
    // Add '/api/auth/refresh-token' if implemented
  ];

  const isPublicApiPath = publicApiPaths.some(path => pathname.startsWith(path));

  // Allow public API calls to proceed directly
  if (isPublicApiPath) {
    return NextResponse.next();
  }

  // If the user has an access token
  if (accessToken) {
    // If authenticated, redirect from any login page or the root to the main admin dashboard.
    // The admin dashboard's client-side logic will handle redirecting tenants to the portal.
    if (pathname === ADMIN_LOGIN_PATH || pathname === PORTAL_LOGIN_PATH || pathname === '/') {
      return NextResponse.redirect(new URL(ADMIN_DASHBOARD_PATH, request.url));
    }
    return NextResponse.next();
  }

  // If the user does NOT have an access token
  if (!accessToken) {
    // If trying to access /admin/*, redirect to the admin login page
    if (pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL(ADMIN_LOGIN_PATH, request.url));
    }

    // If trying to access /portal/* (but not the portal login page itself), redirect to the portal login page
    if (pathname.startsWith('/portal') && pathname !== PORTAL_LOGIN_PATH) {
      return NextResponse.redirect(new URL(PORTAL_LOGIN_PATH, request.url));
    }
    
    // Redirect root to admin login if not authenticated
    if (pathname === '/') {
      return NextResponse.redirect(new URL(ADMIN_LOGIN_PATH, request.url));
    }
  }

  return NextResponse.next();
}

// Matcher to specify which routes the middleware should run on.
// This configuration tries to match all paths except for Next.js internal static files and image optimization.
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Any other static assets like .svg, .png, .jpg, .jpeg, .gif, .webp)$).*)',
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
