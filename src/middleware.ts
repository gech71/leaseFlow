
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
  const portalToken = request.cookies.get(PORTAL_ACCESS_TOKEN_KEY)?.value;

  const publicApiPaths = [
    '/api/auth/login', // Admin login
    '/api/auth/portal/login', // Portal login
    '/api/auth/logout', // Admin logout
    '/api/auth/portal/logout', // Portal logout
    '/api/portal/validate-token',
  ];

  if (publicApiPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Handle portal paths
  if (pathname.startsWith('/portal')) {
    // If trying to access login page but already logged in, redirect to dashboard
    if (pathname === PORTAL_LOGIN_PATH && portalToken) {
      return NextResponse.redirect(new URL(PORTAL_DASHBOARD_PATH, request.url));
    }
    // If accessing a protected portal page without a token, redirect to login
    if (!portalToken && pathname.startsWith(PORTAL_DASHBOARD_PATH)) {
      return NextResponse.redirect(new URL(PORTAL_LOGIN_PATH, request.url));
    }
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
