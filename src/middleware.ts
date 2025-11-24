
import { NextResponse, type NextRequest } from 'next/server';
import { verifySession } from '@/lib/auth/jwt';
import { PERMISSION_MAP } from '@/lib/auth-utils';

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 1. Allow public routes and auth API routes to pass through early
  const isApiAuthRoute = pathname.startsWith('/api/auth');
  const isPublicRoute = PUBLIC_ROUTES.some(path => pathname.startsWith(path)) || pathname === '/';
  
  if (isPublicRoute && !isApiAuthRoute) { // Auth routes need session check later
    // If user is already logged in and tries to access login page, redirect them
    if (pathname === '/login' || pathname === '/') {
        const session = await verifySession();
        if (session) {
          const userPermissions = new Set(session.permissions);
          const isTenant = userPermissions.has('portal:view') && userPermissions.size === 1 && !session.isSuperAdmin;
          const redirectUrl = isTenant ? '/portal/dashboard' : '/admin/dashboard';
          return NextResponse.redirect(new URL(redirectUrl, request.url));
        }
    }
    return NextResponse.next();
  }

  // 2. For all other routes, a session is required
  const session = await verifySession();
  
  // 3. CSRF Protection for state-changing requests
  const isStateChangingMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method);
  if (isStateChangingMethod) {
    if (!session) {
      // Don't reveal CSRF failure for unauthenticated users, just deny access.
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }
    const requestCsrfToken = request.headers.get('x-csrf-token');
    const sessionCsrfToken = session.csrfToken;

    if (!requestCsrfToken || !sessionCsrfToken || requestCsrfToken !== sessionCsrfToken) {
      console.warn(`CSRF token mismatch. Path: ${pathname}, Method: ${request.method}`);
      return NextResponse.json({ message: 'Invalid CSRF token.' }, { status: 403 });
    }
  }


  // 4. Handle authentication and token refresh
  if (isApiAuthRoute) {
    if (pathname.startsWith('/api/auth/refresh')) {
      // The refresh logic is handled in the route itself.
      return NextResponse.next();
    }
  }

  if (!session) {
    // Attempt to refresh only if it's not an auth API call
    if (!isApiAuthRoute) {
        const refreshResponse = await fetch(new URL('/api/auth/refresh', request.url), {
            method: 'POST',
            headers: {
                'Cookie': request.headers.get('Cookie') || '',
            }
        });

        if (refreshResponse.ok) {
            const response = NextResponse.next();
            const newAccessToken = refreshResponse.headers.get('set-cookie');
            if (newAccessToken) {
                response.headers.set('set-cookie', newAccessToken);
            }
            return response;
        }
    }
    
    // If no session and refresh fails, redirect to login
    let from = pathname;
    if (request.nextUrl.search) {
      from += request.nextUrl.search;
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', from);
    loginUrl.searchParams.set('error', 'session_expired');
    return NextResponse.redirect(loginUrl);
  }
  
  // 5. Handle forced password change
  if (session.forceChangePass && !pathname.startsWith('/portal/change-password')) {
    return NextResponse.redirect(new URL('/portal/change-password', request.url));
  }
  if (!session.forceChangePass && pathname.startsWith('/portal/change-password')) {
     return NextResponse.redirect(new URL('/portal/dashboard', request.url));
  }

  // 6. Handle role-based authorization for admin routes
  if (pathname.startsWith('/admin')) {
    if (session.isSuperAdmin) {
      return NextResponse.next();
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

  // 7. If all checks pass, allow the request
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images).*)'],
};
