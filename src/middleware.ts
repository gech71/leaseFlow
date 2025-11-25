
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
  
  const isApiRoute = pathname.startsWith('/api/');
  const isPublicRoute = PUBLIC_ROUTES.some(path => pathname.startsWith(path)) || pathname === '/';
  
  // If it's a public file, let it go
  if (pathname.includes('.')) {
    return response;
  }
  
  // Verify session for all non-public routes
  const session = await verifySession();
  
  if (!session) {
    if (isPublicRoute) {
      return response; // Allow access to public routes
    }
    
    // For protected routes, redirect to login
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
  
  // --- If session exists ---

  // If user is authenticated and tries to access login page, redirect them
  if (pathname === '/login' || pathname === '/') {
      const userPermissions = new Set(session.permissions);
      const isTenant = userPermissions.has('portal:view') && userPermissions.size === 1 && !session.isSuperAdmin;
      const redirectUrl = isTenant ? '/portal/dashboard' : '/admin/dashboard';
      return NextResponse.redirect(new URL(redirectUrl, request.url));
  }

  // Handle forced password change
  if (session.forceChangePass && !pathname.startsWith('/portal/change-password')) {
    return NextResponse.redirect(new URL('/portal/change-password', request.url));
  }
  if (!session.forceChangePass && pathname.startsWith('/portal/change-password')) {
     return NextResponse.redirect(new URL('/portal/dashboard', request.url));
  }

  const userPermissions = new Set(session.permissions);
  const isTenantOnly = userPermissions.has('portal:view') && userPermissions.size === 1 && !session.isSuperAdmin;

  // Handle role-based authorization for admin routes
  if (pathname.startsWith('/admin')) {
    if (isTenantOnly) {
      return NextResponse.redirect(new URL('/portal/dashboard', request.url));
    }

    if (session.isSuperAdmin) {
      return response;
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
  
  // Handle role-based authorization for portal routes
  if (pathname.startsWith('/portal/') && !isPublicRoute) {
    if (!isTenantOnly) {
      // Any user who is NOT a tenant (e.g., an admin) trying to access the tenant portal is redirected.
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
  }

  // If all checks pass, allow the request
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images).*)'],
};
