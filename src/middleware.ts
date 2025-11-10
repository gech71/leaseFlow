import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  const isPortalChangePassPage = nextUrl.pathname === '/portal/change-password';

  if (isLoggedIn && req.auth?.user.forceChangePass) {
    // If the user is logged in and MUST change their password
    if (!isPortalChangePassPage) {
      // And they are NOT on the change password page, redirect them there.
      return NextResponse.redirect(new URL('/portal/change-password', nextUrl));
    }
  } else if (isLoggedIn && isPortalChangePassPage) {
    // If the user is logged in but doesn't need to change password,
    // they shouldn't be on this page. Redirect them away.
    return NextResponse.redirect(new URL('/portal/dashboard', nextUrl));
  }

  // Redirect unauthenticated users trying to access protected admin routes
  if (nextUrl.pathname.startsWith('/admin') && !isLoggedIn) {
    return NextResponse.redirect(new URL('/login', nextUrl));
  }
  
  // Allow all other requests
  return NextResponse.next();
});

// See "Matching Paths" below to learn more
export const config = {
  matcher: ['/admin/:path*', '/portal/change-password'],
};
