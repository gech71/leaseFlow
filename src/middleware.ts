
import { NextResponse, type NextRequest } from 'next/server';
import { verifySession } from '@/lib/auth/jwt';
import { PERMISSION_MAP } from '@/lib/auth-utils';
import { redirectWithToast } from './lib/actions/server-helpers';

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
  const session = await verifySession();

  const isApiAuthRoute = pathname.startsWith('/api/auth');
  const isPublicRoute = PUBLIC_ROUTES.some(path => pathname.startsWith(path));

  if (isPublicRoute || isApiAuthRoute) {
    if (session && pathname === '/login') {
      const redirectUrl = session.permissions.includes('portal:view') && session.permissions.length === 1
        ? '/portal/dashboard'
        : '/admin/dashboard';
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    let from = pathname;
    if (request.nextUrl.search) {
      from += request.nextUrl.search;
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', from);
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
