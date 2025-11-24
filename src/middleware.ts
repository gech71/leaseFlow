import { NextResponse, type NextRequest } from 'next/server';
import { verifySession } from '@/lib/auth/jwt';
import { PERMISSION_MAP } from '@/lib/auth-utils';
import crypto from 'crypto';

const ORDERED_ADMIN_PAGES = [
  "/admin/dashboard",
  "/admin/buildings",
  "/admin/spaces",
  "/admin/tenants",
  "/admin/agreements",
  "/admin/billing",
  "/admin/payments-overview",
  "/admin/building-utilities",
  "/admin/settings/user-management",
  "/admin/import",
];

const PUBLIC_ROUTES = ['/login', '/portal/connect', '/portal/cancel', '/portal/error', '/api/portal/payment-callback', '/api/portal/Arifcallback' ];
const CSRF_TOKEN_COOKIE_NAME = 'nibrental_csrf_token';


export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);
  
  // Create a response object that we can modify
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  // 1. Ensure a CSRF token exists for all visits (for unauthenticated and authenticated forms)
  const isGetRequest = request.method === 'GET';
  let csrfToken = request.cookies.get(CSRF_TOKEN_COOKIE_NAME)?.value;
  if (isGetRequest && !csrfToken) {
    csrfToken = crypto.randomBytes(32).toString('hex');
    response.cookies.set(CSRF_TOKEN_COOKIE_NAME, csrfToken, {
      httpOnly: false, // Must be readable by client script
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
    });
  }

  // 2. Allow public routes and auth API routes to pass through early
  const isApiAuthRoute = pathname.startsWith('/api/auth');
  const isPublicRoute = PUBLIC_ROUTES.some(path => pathname.startsWith(path)) || pathname === '/';
  
  if (isPublicRoute && !isApiAuthRoute) { // Auth routes need session check later
    if (pathname === '/login' || pathname === '/') {
        const session = await verifySession();
        if (session) {
          const userPermissions = new Set(session.permissions);
          const isTenant = userPermissions.has('portal:view') && userPermissions.size === 1 && !session.isSuperAdmin;
          const redirectUrl = isTenant ? '/portal/dashboard' : '/admin/dashboard';
          return NextResponse.redirect(new URL(redirectUrl, request.url));
        }
    }
    // Return the response object which may contain the new CSRF cookie
    return response;
  }

  // 3. For all other routes, a session is required
  const session = await verifySession();
  
  // 4. CSRF Protection for state-changing requests (including unauthenticated login)
  const isStateChangingMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method);
  if (isStateChangingMethod && !pathname.startsWith('/api/portal/')) {
    const requestCsrfToken = request.headers.get('x-csrf-token');
    const cookieCsrfToken = request.cookies.get(CSRF_TOKEN_COOKIE_NAME)?.value;

    if (!requestCsrfToken || !cookieCsrfToken || requestCsrfToken !== cookieCsrfToken) {
      console.warn(`CSRF token mismatch. Path: ${pathname}, Method: ${request.method}`);
      return NextResponse.json({ message: 'Invalid CSRF token.' }, { status: 403 });
    }
  }

  // 5. Handle authentication and token refresh
  if (isApiAuthRoute) {
    if (pathname.startsWith('/api/auth/refresh') || pathname.startsWith('/api/auth/login')) {
      // The logic is handled in the route itself.
      return NextResponse.next();
    }
  }

  if (!session) {
    let from = pathname;
    if (request.nextUrl.search) {
      from += request.nextUrl.search;
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', from);
    loginUrl.searchParams.set('error', 'session_expired');
    return NextResponse.redirect(loginUrl);
  }
  
  // 6. Handle forced password change
  if (session.forceChangePass && !pathname.startsWith('/portal/change-password')) {
    return NextResponse.redirect(new URL('/portal/change-password', request.url));
  }
  if (!session.forceChangePass && pathname.startsWith('/portal/change-password')) {
     return NextResponse.redirect(new URL('/portal/dashboard', request.url));
  }

  // 7. Handle role-based authorization for admin routes
  if (pathname.startsWith('/admin')) {
    if (session.isSuperAdmin) {
      return response;
    }

    const userPermissions = new Set(session.permissions);
    
    const isTenantOnly = userPermissions.has('portal:view') && userPermissions.size === 1;
    if (isTenantOnly) {
      return NextResponse.redirect(new URL('/portal/dashboard', request.url));
    }

    const requiredPermission = Object.entries(PERMISSION_MAP).find(([pathPrefix]) => 
      pathname.startsWith(pathPrefix)
    )?.[1];
    
    if (requiredPermission && !userPermissions.has(requiredPermission)) {
      const firstAllowedPage = ORDERED_ADMIN_PAGES.find(page => {
        const permission = PERMISSION_MAP[page];
        return permission && userPermissions.has(permission);
      });

      const redirectUrl = new URL(firstAllowedPage || '/login', request.url);
      const errorMessage = firstAllowedPage 
        ? "You do not have permission to access the requested page."
        : "You do not have any assigned permissions to access the admin panel.";
      redirectUrl.searchParams.set("error", errorMessage);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // 8. If all checks pass, allow the request
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images).*)'],
};
