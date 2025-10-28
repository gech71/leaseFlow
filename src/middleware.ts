
import { NextResponse, type NextRequest } from 'next/server';

const ADMIN_ACCESS_TOKEN_KEY = 'nibrental_admin_access_token';
const ADMIN_REFRESH_TOKEN_KEY = 'nibrental_admin_refresh_token';
const PORTAL_ACCESS_TOKEN_KEY = 'nibrental_portal_access_token'; // This will be phased out but we clear it for safety

const ADMIN_DEFAULT_PATH = '/admin/profile'; // Changed from dashboard
const PORTAL_DASHBOARD_PATH = '/portal/dashboard';
const LOGIN_PATH = '/login';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;

// Insecure JWT payload decoder for prototype purposes ONLY.
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

async function handleAuthenticatedSession(request: NextRequest): Promise<NextResponse> {
  const adminToken = request.cookies.get(ADMIN_ACCESS_TOKEN_KEY)?.value;
  const refreshToken = request.cookies.get(ADMIN_REFRESH_TOKEN_KEY)?.value;

  if (!adminToken || !refreshToken) {
    // If either token is missing, redirect to login
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
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
      return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
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

  // If refresh fails for any reason, redirect to login and clear invalid tokens
  const redirectResponse = NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  redirectResponse.cookies.delete(ADMIN_ACCESS_TOKEN_KEY);
  redirectResponse.cookies.delete(ADMIN_REFRESH_TOKEN_KEY);
  redirectResponse.cookies.delete(PORTAL_ACCESS_TOKEN_KEY); // Clean up old portal cookie too
  return redirectResponse;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  const hasSessionToken = request.cookies.has(ADMIN_ACCESS_TOKEN_KEY);

  // --- Public Unprotected Routes ---
  const publicPaths = [
    LOGIN_PATH, 
    '/portal/connect', // NIB App entry point remains public
    '/portal/billing'  // NIB App billing page remains public
  ];
  const publicApiPaths = [
    '/api/Auth/login', 
    '/api/Auth/logout',
    '/api/Auth/forgot-password',
    '/api/Auth/reset-password',
    '/api/Auth/change-password',
    '/api/portal/validate-token',
    '/api/portal/payment-callback',
    '/api/portal/Arifcallback',
    '/api/Auth/register',
  ];

  const isPublicPath = publicPaths.some(path => pathname.startsWith(path)) || 
                       publicApiPaths.some(path => pathname.startsWith(path));

  if (isPublicPath) {
    // If user is already logged in and trying to access login page, redirect them to their dashboard
    if (pathname === LOGIN_PATH && hasSessionToken) {
        // We can't know the role here without a DB call, so we redirect to a generic home
        // which will then redirect to the correct dashboard.
        return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // --- Protected Routes ---
  // All other routes under /admin and /portal require an authenticated session
  if (pathname.startsWith('/admin') || pathname.startsWith('/portal')) {
    return handleAuthenticatedSession(request);
  }
  
  // --- Root Path Redirect ---
  if (pathname === '/') {
    if (hasSessionToken) {
      // Redirect to a safe default page. The client-side layout will then redirect to the correct dashboard if applicable.
      return NextResponse.redirect(new URL(ADMIN_DEFAULT_PATH, request.url));
    }
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
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
