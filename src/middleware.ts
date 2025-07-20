
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

  // --- Redirect from /login to /auth/login ---
  if (pathname === '/login') {
    return NextResponse.redirect(new URL(ADMIN_LOGIN_PATH, request.url));
  }

  // --- Public Unprotected Routes ---
  const publicPaths = [
    ADMIN_LOGIN_PATH, 
    PORTAL_LOGIN_PATH, 
    '/portal/connect',
    '/portal/billing'
  ];
  const publicApiPaths = [
    '/api/auth/login', 
    '/api/auth/portal/login', 
    '/api/auth/logout', 
    '/api/auth/portal/logout', 
    '/api/portal/validate-token',
    '/api/portal/payment-callback',
  ];

  if (publicPaths.some(path => pathname.startsWith(path)) || publicApiPaths.some(path => pathname.startsWith(path))) {
    // Special case: If a logged-in admin tries to access the login page, redirect them.
    if(pathname === ADMIN_LOGIN_PATH && adminToken) {
      return NextResponse.redirect(new URL(ADMIN_DASHBOARD_PATH, request.url));
    }
    // Special case: If a logged-in tenant tries to access the login page, redirect them.
     if(pathname === PORTAL_LOGIN_PATH && portalToken) {
      return NextResponse.redirect(new URL(PORTAL_DASHBOARD_PATH, request.url));
    }
    return NextResponse.next();
  }

  // --- Protected Admin Routes ---
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    if (!adminToken) {
      return NextResponse.redirect(new URL(ADMIN_LOGIN_PATH, request.url));
    }
  }
  
  // --- Protected Portal Routes ---
  if (pathname.startsWith('/portal')) {
     if (!portalToken) {
      return NextResponse.redirect(new URL(PORTAL_LOGIN_PATH, request.url));
    }
  }
  
  // --- Root Path Redirect ---
  if (pathname === '/') {
    if (adminToken) {
      return NextResponse.redirect(new URL(ADMIN_DASHBOARD_PATH, request.url));
    }
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
