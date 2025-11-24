
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
  
  const isApiAuthRoute = pathname.startsWith('/api/auth');
  const isPublicRoute = PUBLIC_ROUTES.some(path => pathname.startsWith(path)) || pathname === '/';
  
  // Allow public routes and auth API routes to be accessed without a session
  if (isPublicRoute || isApiAuthRoute) {
    // If user is already logged in and tries to access login page, redirect them
    if (pathname === '/login' || pathname === '/') {
        const session = await verifySession(); // Still need to check for a valid session here
        if (session) {
          const userPermissions = new Set(session.permissions);
          const isTenant = userPermissions.has('portal:view') && userPermissions.size === 1;
          const redirectUrl = isTenant ? '/portal/dashboard' : '/admin/dashboard';
          return NextResponse.redirect(new URL(redirectUrl, request.url));
        }
    }
    return NextResponse.next();
  }

  // For all other routes, a session is required
  const session = await verifySession();

  if (!session) {
    // If no access token, try to refresh it silently.
    const refreshResponse = await fetch(new URL('/api/auth/refresh', request.url), {
        method: 'POST',
        headers: {
            'Cookie': request.headers.get('Cookie') || '',
        }
    });

    if (refreshResponse.ok) {
        // If refresh is successful, the new token is set in cookies.
        // We can just proceed with the request, and the new cookie will be sent along.
        // The `NextResponse.next()` will have the `set-cookie` header from the refresh response.
        const response = NextResponse.next();

        // Forward the new cookies from the refresh response to the client browser
        const newAccessToken = refreshResponse.headers.get('set-cookie');
        if (newAccessToken) {
            response.headers.set('set-cookie', newAccessToken);
        }
        return response;
    }

    // If refresh fails, then redirect to login.
    let from = pathname;
    if (request.nextUrl.search) {
      from += request.nextUrl.search;
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', from);
    loginUrl.searchParams.set('error', 'session_expired');
    return NextResponse.redirect(loginUrl);
  }
  
  if (session.forceChangePass && !pathname.startsWith('/portal/change-password')) {
    return NextResponse.redirect(new URL('/portal/change-password', request.url));
  }
  if (!session.forceChangePass && pathname.startsWith('/portal/change-password')) {
     return NextResponse.redirect(new URL('/portal/dashboard', request.url));
  }


  if (pathname.startsWith('/admin')) {
    if (session.isSuperAdmin) {
      return NextResponse.next();
    }

    const userPermissions = new Set(session.permissions);
    
    if (userPermissions.size === 1 && userPermissions.has('portal:view')) {
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

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/|_next/static|_next/image|favicon.ico|images).*)'],
};
