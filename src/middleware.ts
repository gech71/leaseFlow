
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Define public paths that don't require authentication
  const publicPaths = [
    "/login", // The login page is public
    "/portal/connect", 
    "/api/portal/payment-callback",
    "/api/portal/Arifcallback",
    "/api/auth", // NextAuth API routes
  ];

  const isPublic = publicPaths.some(path => pathname.startsWith(path));
  
  // Use a lightweight API call to check session status
  const sessionApiUrl = new URL('/api/auth/session', request.url);
  const response = await fetch(sessionApiUrl, {
    headers: {
      cookie: request.headers.get('cookie') || '',
    },
  });
  const sessionData = await response.json();
  const isLoggedIn = sessionData.isLoggedIn;
  
  if (isPublic) {
    // If user is logged in and tries to access login page, redirect them to the dashboard
    if (isLoggedIn && pathname.startsWith('/login')) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
    // Otherwise, allow access to public pages
    return NextResponse.next();
  }

  // If the path is not public and user is not logged in, redirect to login
  if (!isLoggedIn) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }
  
  // If user is logged in and accessing a protected route, allow access
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - any files with extensions (e.g. .svg, .png, .jpg)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

    