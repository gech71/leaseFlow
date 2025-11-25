import { NextResponse, type NextRequest } from 'next/server';
import { verifySession } from '@/lib/auth/jwt';
import { PERMISSION_MAP } from '@/lib/auth-utils';
import { nanoid } from 'nanoid';

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
  
  let response = NextResponse.next();

  // --- CSRF Token Generation ---
  // Generate a CSRF token if one doesn't exist. This will be attached to every response.
  const csrfToken = request.cookies.get(CSRF_TOKEN_COOKIE_NAME)?.value;
  if (!csrfToken) {
    response.cookies.set(CSRF_TOKEN_COOKIE_NAME, nanoid(32), {
      httpOnly: false, // Must be readable by client script
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
    });
  }
  // --- End CSRF Token Generation ---

  // Allow public routes and auth API routes to pass through early
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
    return response;
  }

  // Handle authentication and token refresh
  if (isApiAuthRoute) {
    // CSRF check for login is handled inside the route. Other auth routes are protected by HttpOnly cookies.
    if (pathname.startsWith('/api/auth/refresh') || pathname.startsWith('/api/auth/login') || pathname.startsWith('/api/auth/logout')) {
      // The logic is handled in the route itself.
      return response; // Return response with CSRF cookie if it was set
    }
  }

  const session = await verifySession();

  if (!session) {
    let from = pathname;
    if (request.nextUrl.search) {
      from += request.nextUrl.search;
    }
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/login' && pathname !== '/') {
        loginUrl.searchParams.set('from', from);
    }
    loginUrl.searchParams.set('error', 'session_expired');
    return NextResponse.redirect(loginUrl);
  }
  
  // Handle forced password change
  if (session.forceChangePass && !pathname.startsWith('/portal/change-password')) {
    return NextResponse.redirect(new URL('/portal/change-password', request.url));
  }
  if (!session.forceChangePass && pathname.startsWith('/portal/change-password')) {
     return NextResponse.redirect(new URL('/portal/dashboard', request.url));
  }

  // Handle role-based authorization for admin routes
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

  // If all checks pass, allow the request
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images).*)'],
};
