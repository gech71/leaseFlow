
import { NextResponse, type NextRequest } from 'next/server';

const ADMIN_ACCESS_TOKEN_KEY = 'leaseflow_admin_access_token';
const ADMIN_REFRESH_TOKEN_KEY = 'leaseflow_admin_refresh_token';
const PORTAL_ACCESS_TOKEN_KEY = 'leaseflow_portal_access_token';

const ADMIN_DASHBOARD_PATH = '/admin/dashboard';
const ADMIN_LOGIN_PATH = '/auth/login';
const PORTAL_DASHBOARD_PATH = '/portal/dashboard';
const PORTAL_LOGIN_PATH = '/portal/login';
const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;

// Insecure JWT payload decoder for prototype purposes ONLY.
// DO NOT USE IN PRODUCTION. Use a proper JWT library (e.g., jose).
function decodeJwtPayload(token: string): any | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Failed to decode JWT payload:', e);
    return null;
  }
}

async function handleAdminSession(request: NextRequest): Promise<NextResponse> {
  const adminToken = request.cookies.get(ADMIN_ACCESS_TOKEN_KEY)?.value;
  const refreshToken = request.cookies.get(ADMIN_REFRESH_TOKEN_KEY)?.value;
  const { pathname } = request.nextUrl;

  if (!adminToken || !refreshToken) {
    return NextResponse.redirect(new URL(ADMIN_LOGIN_PATH, request.url));
  }
  
  const tokenPayload = decodeJwtPayload(adminToken);
  const isExpired = !tokenPayload || (tokenPayload.exp * 1000) < Date.now();

  if (!isExpired) {
    // Token is valid, proceed
    return NextResponse.next();
  }
  
  // --- Token is expired, try to refresh it ---
  if (!AUTH_API_BASE_URL) {
      console.error("Middleware Error: Auth API base URL is not configured for token refresh.");
      return NextResponse.redirect(new URL(ADMIN_LOGIN_PATH, request.url));
  }

  try {
    const response = await fetch(`${AUTH_API_BASE_URL}/api/Auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: adminToken, refreshToken: refreshToken }),
    });

    if (response.ok) {
        const data = await response.json();
        const newAccessToken = data.accessToken;
        const newRefreshToken = data.refreshToken;

        if (newAccessToken && newRefreshToken) {
            // Set new tokens and continue to the requested page
            const responseToClient = NextResponse.next();
            responseToClient.cookies.set(ADMIN_ACCESS_TOKEN_KEY, newAccessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                path: '/',
                sameSite: 'lax',
            });
            responseToClient.cookies.set(ADMIN_REFRESH_TOKEN_KEY, newRefreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                path: '/',
                sameSite: 'lax',
            });
            return responseToClient;
        }
    }
  } catch (error) {
      console.error("Middleware: Error refreshing token:", error);
  }

  // If refresh fails for any reason, redirect to login
  const redirectResponse = NextResponse.redirect(new URL(ADMIN_LOGIN_PATH, request.url));
  // Clear the invalid tokens
  redirectResponse.cookies.delete(ADMIN_ACCESS_TOKEN_KEY);
  redirectResponse.cookies.delete(ADMIN_REFRESH_TOKEN_KEY);
  return redirectResponse;
}


export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  const adminToken = request.cookies.get(ADMIN_ACCESS_TOKEN_KEY)?.value;
  const portalToken = request.cookies.get(PORTAL_ACCESS_TOKEN_KEY)?.value;

  // --- Redirect from /login to /auth/login ---
  if (pathname === '/login') {
    return NextResponse.redirect(new URL(ADMIN_LOGIN_PATH, request.url));
  }

  // --- Public Unprotected Routes ---
  const publicPaths = [
    ADMIN_LOGIN_PATH, 
    '/auth/forgot-password',
    '/auth/reset-password',
    PORTAL_LOGIN_PATH, 
    '/portal/connect',
    '/portal/billing'
  ];
  const publicApiPaths = [
    '/api/Auth/login', 
    '/api/Auth/portal/login', 
    '/api/Auth/logout', 
    '/api/Auth/portal/logout', 
    '/api/Auth/forgot-password',
    '/api/Auth/reset-password',
    '/api/Auth/change-password',
    '/api/portal/validate-token',
    '/api/portal/payment-callback',
    '/api/Auth/register',
  ];

  if (publicPaths.some(path => pathname.startsWith(path)) || publicApiPaths.some(path => pathname.startsWith(path))) {
    if(pathname === ADMIN_LOGIN_PATH && adminToken) {
      return NextResponse.redirect(new URL(ADMIN_DASHBOARD_PATH, request.url));
    }
     if(pathname === PORTAL_LOGIN_PATH && portalToken) {
      return NextResponse.redirect(new URL(PORTAL_DASHBOARD_PATH, request.url));
    }
    return NextResponse.next();
  }

  // --- Protected Admin Routes ---
  if (pathname.startsWith('/admin') || (pathname.startsWith('/api/') && !publicApiPaths.some(path => pathname.startsWith(path)))) {
    return handleAdminSession(request);
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
