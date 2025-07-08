
import { NextResponse, type NextRequest } from 'next/server';

const ADMIN_ACCESS_TOKEN_KEY = 'leaseflow_admin_access_token';
const PORTAL_ACCESS_TOKEN_KEY = 'leaseflow_portal_access_token';

const ADMIN_DASHBOARD_PATH = '/admin/dashboard';
const ADMIN_LOGIN_PATH = '/auth/login';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Read tokens from cookies
  const adminToken = request.cookies.get(ADMIN_ACCESS_TOKEN_KEY)?.value;

  const publicApiPaths = [
    '/api/auth/login', // Admin login
    '/api/auth/logout', // Admin logout
    '/api/auth/portal/logout', // Portal logout
    '/api/portal/validate-token', // Public validation endpoint for the connect page
  ];

  if (publicApiPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Handle portal paths. The entry point is /portal/connect, which expects a header.
  // Other portal pages rely on the cookie set by the connect page.
  if (pathname.startsWith('/portal') && pathname !== '/portal/connect') {
      const portalToken = request.cookies.get(PORTAL_ACCESS_TOKEN_KEY)?.value;
      if(!portalToken) {
          // If no session cookie, they must re-enter through the connect flow.
          // We can show an error or simply let the page handle it.
          // For now, let the page handle it as it will fail to fetch data.
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
