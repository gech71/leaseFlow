
import { NextResponse, type NextRequest } from 'next/server';

const ACCESS_TOKEN_KEY = 'leaseflow_access_token';
const ADMIN_DASHBOARD_PATH = '/admin/dashboard';
const ADMIN_LOGIN_PATH = '/auth/login';
const PORTAL_DASHBOARD_PATH = '/portal/dashboard';
const PORTAL_LOGIN_PATH = '/portal/login';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Read token from both potential sources
  const cookieToken = request.cookies.get(ACCESS_TOKEN_KEY)?.value;
  const authHeader = request.headers.get('Authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const accessToken = bearerToken || cookieToken;

  const publicApiPaths = ['/api/auth/login', '/api/auth/logout'];
  const isPublicApiPath = publicApiPaths.some(path => pathname.startsWith(path));

  if (isPublicApiPath) {
    return NextResponse.next();
  }

  // If the user has an access token (from either source)
  if (accessToken) {
    // Context: Mini App using Bearer Token
    if (bearerToken) {
      if (pathname.startsWith('/admin') || pathname.startsWith('/auth')) {
        return new NextResponse('Unauthorized: Mini App access is restricted to the portal.', { status: 403 });
      }
      if (pathname === '/') {
        return NextResponse.redirect(new URL(PORTAL_DASHBOARD_PATH, request.url));
      }
      // Allow access to /portal/* and other necessary APIs
      return NextResponse.next();
    }

    // Context: Web App using Cookie
    if (cookieToken) {
      if (pathname === ADMIN_LOGIN_PATH || pathname === PORTAL_LOGIN_PATH || pathname === '/') {
        return NextResponse.redirect(new URL(ADMIN_DASHBOARD_PATH, request.url));
      }
      return NextResponse.next();
    }
  }

  // If the user does NOT have an access token
  if (!accessToken) {
    if (pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL(ADMIN_LOGIN_PATH, request.url));
    }
    if (pathname.startsWith('/portal') && pathname !== PORTAL_LOGIN_PATH) {
      return NextResponse.redirect(new URL(PORTAL_LOGIN_PATH, request.url));
    }
    if (pathname === '/') {
      return NextResponse.redirect(new URL(ADMIN_LOGIN_PATH, request.url));
    }
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
