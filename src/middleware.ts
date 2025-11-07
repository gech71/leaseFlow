import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const publicPaths = [
    "/", // The root is now the login page
    "/portal/connect", 
    "/api/portal/payment-callback",
    "/api/portal/Arifcallback",
    "/api/auth", 
  ];

  const isPublic = publicPaths.some(path => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  });
  
  const sessionApiUrl = new URL('/api/auth/session', request.url);
  const response = await fetch(sessionApiUrl, {
    headers: {
      cookie: request.headers.get('cookie') || '',
    },
  });
  const sessionData = await response.json();
  const isLoggedIn = sessionData.isLoggedIn;
  
  if (isPublic) {
    if (isLoggedIn && pathname === '/') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    const loginUrl = new URL('/', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
