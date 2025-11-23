import { NextResponse, type NextRequest } from 'next/server';
import { verifySession, type SessionPayload } from '@/lib/auth/jwt';
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

const PUBLIC_ROUTES = ['/login', '/portal/connect', '/portal/cancel', '/portal/error'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await verifySession();

  const isApiAuthRoute = pathname.startsWith('/api/auth');
  const isPublicRoute = PUBLIC_ROUTES.some(path => pathname.startsWith(path));

  // If trying to access a public route or an API auth route, allow it
  if (isPublicRoute || isApiAuthRoute) {
    // But if logged in and trying to access login, redirect to dashboard
    if (session && pathname === '/login') {
      const redirectUrl = session.permissions.includes('portal:view') && session.permissions.length === 1
        ? '/portal/dashboard'
        : '/admin/dashboard';
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }
    return NextResponse.next();
  }

  // --- Protected Routes Logic ---

  if (!session) {
    let from = pathname;
    if (request.nextUrl.search) {
      from += request.nextUrl.search;
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', from);
    return NextResponse.redirect(loginUrl);
  }

  // Enforce password change if required
  if (session.forceChangePass && pathname !== '/portal/change-password') {
    return NextResponse.redirect(new URL('/portal/change-password', request.url));
  }
  if (!session.forceChangePass && pathname === '/portal/change-password') {
    return NextResponse.redirect(new URL('/portal/dashboard', request.url));
  }

  // Admin path protection
  if (pathname.startsWith('/admin')) {
    if (session.isSuperAdmin) {
      return NextResponse.next(); // Super admin bypasses permission checks
    }

    const userPermissions = new Set(session.permissions);
    
    // Redirect pure tenants away from admin
    if (userPermissions.size === 1 && userPermissions.has('portal:view')) {
      return NextResponse.redirect(new URL('/portal/dashboard', request.url));
    }

    // Check permission for the specific admin route
    const requiredPermission = Object.entries(PERMISSION_MAP).find(([pathPrefix]) => 
      pathname.startsWith(pathPrefix)
    )?.[1];
    
    if (requiredPermission && !userPermissions.has(requiredPermission)) {
      // Find the first page they are allowed to see
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

// Matcher to run the middleware on all routes except for static assets and _next internal files.
export const config = {
  matcher: ['/((?!api/|_next/static|_next/image|favicon.ico|images).*)'],
};
