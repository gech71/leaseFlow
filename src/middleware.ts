
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const publicPaths = [
    "/login", 
    "/portal/connect", 
    "/api/portal/payment-callback",
    "/api/portal/Arifcallback",
    "/api/auth", // Allow all NextAuth.js API routes and our session check
  ];

  const isPublic = publicPaths.some(path => pathname.startsWith(path));

  // Let the session API route through without checks
  if (pathname === '/api/auth/session') {
    return NextResponse.next();
  }

  // Fetch the session status from our new API endpoint
  const sessionApiUrl = new URL('/api/auth/session', request.url);
  const response = await fetch(sessionApiUrl, {
    headers: {
      cookie: request.headers.get('cookie') || '',
    },
  });
  const sessionData = await response.json();
  const isLoggedIn = sessionData.isLoggedIn;
  
  // If it's a public path, let them through, but redirect if a logged-in user tries to access /login
  if (isPublic) {
    if (isLoggedIn && pathname === '/login') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // If it's not a public path and the user is not logged in, redirect to login
  if (!isLoggedIn) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }
  
  // If user is logged in and at the root, redirect to the appropriate dashboard
  if (pathname === '/') {
     // We can't know the role here, so we redirect to a default dashboard.
     // The client-side layout will handle role-based redirects (e.g., tenant to /portal/dashboard)
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }

  // If everything is fine, proceed with the request
  return NextResponse.next();
}

export const config = {
  matcher: [
    // This matcher ensures the middleware runs on all routes except for static files and images.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
