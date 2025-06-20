
import { NextResponse, type NextRequest } from 'next/server';

const ACCESS_TOKEN_KEY = 'leaseflow_access_token';
const ADMIN_DASHBOARD_PATH = '/admin/dashboard';
const LOGIN_PATH = '/auth/login';

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
    // If they are trying to access the login page or the root page, redirect them to the admin dashboard
    if (pathname === LOGIN_PATH || pathname === '/') {
      return NextResponse.redirect(new URL(ADMIN_DASHBOARD_PATH, request.url));
    }
    // Otherwise, allow them to proceed to the requested page (e.g., /admin/*, /portal/*)
    return NextResponse.next();
  }

  // If the user does NOT have an access token
  if (!accessToken) {
    // If they are trying to access any /admin/* or /portal/* path, redirect to login
    if (pathname.startsWith('/admin') || pathname.startsWith('/portal')) {
      return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
    }
    // Allow access to the login page itself, or the root (which will redirect to login via page.tsx)
    // and any other non-protected, non-API public pages (if any existed)
    return NextResponse.next();
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
     * - Any other static assets like .svg, .png, etc. if served directly
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
