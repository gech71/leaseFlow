
import { NextResponse, type NextRequest } from 'next/server';

const ADMIN_ACCESS_TOKEN_KEY = 'leaseflow_admin_access_token';
const PORTAL_ACCESS_TOKEN_KEY = 'leaseflow_portal_access_token';

const ADMIN_DASHBOARD_PATH = '/admin/dashboard';
const ADMIN_LOGIN_PATH = '/auth/login';
const PORTAL_DASHBOARD_PATH = '/portal/dashboard';
const PORTAL_LOGIN_PATH = '/portal/login';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Read tokens from cookies
  const adminToken = request.cookies.get(ADMIN_ACCESS_TOKEN_KEY)?.value;
  
  // Read Bearer token for Mini App case
  const authHeader = request.headers.get('Authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  const publicApiPaths = [
    '/api/auth/login', // Admin login
    '/api/auth/logout', // Admin logout
    '/api/auth/portal/logout', // Portal logout
  ];

  if (publicApiPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Handle portal paths
  if (pathname.startsWith('/portal')) {
    // We no longer check for a token here. We let the request go to the page,
    // which will show a loading state and then handle auth itself.
    // This allows the page to be the single source of truth for portal auth state.
    // The old login page at /portal/login will now be deleted.
    return NextResponse.next();
  }

  // Handle admin paths
  if (pathname.startsWith('/admin') || pathname === ADMIN_LOGIN_PATH) {
    // If trying to access login page but already logged in, redirect to dashboard
    if (pathname === ADMIN_LOGIN_PATH && adminToken) {
      return NextResponse.redirect(new URL(ADMIN_DASHBOARD_PATH, request.url));
    }
    // If not logged in and not on login page, redirect to admin login
    if (!adminToken && pathname !== ADMIN_LOGIN_PATH) {
      return NextResponse.redirect(new URL(ADMIN_LOGIN_PATH, request.url));
    }
    return NextResponse.next();
  }

  // Handle root path
  if (pathname === '/') {
    // Prioritize admin session
    if (adminToken) {
      return NextResponse.redirect(new URL(ADMIN_DASHBOARD_PATH, request.url));
    }
    // Default to admin login if no session exists
    return NextResponse.redirect(new URL(ADMIN_LOGIN_PATH, request.url));
  }
  
  return NextResponse.next();
}

// Matcher to specify which routes the middleware should run on.
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
