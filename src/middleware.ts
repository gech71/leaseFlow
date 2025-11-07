
import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth'; // Import from the centralized auth file

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await auth(); // Use NextAuth.js to get the session
  const isLoggedIn = !!session;

  const publicPaths = [
    "/login", 
    "/portal/connect", 
    "/api/portal/payment-callback",
    "/api/portal/Arifcallback",
    "/api/auth", // Allow all NextAuth.js API routes
  ];

  const isPublic = publicPaths.some(path => pathname.startsWith(path));

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
     // Based on role, redirect to the appropriate dashboard
    const isTenant = session.user?.roles?.includes('TENANT') && session.user.roles.length === 1;
    const redirectUrl = isTenant ? '/portal/dashboard' : '/admin/dashboard';
    return NextResponse.redirect(new URL(redirectUrl, request.url));
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
