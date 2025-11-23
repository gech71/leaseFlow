
import { auth } from "@/auth";
import { NextResponse, type NextRequest } from "next/server";
import { PERMISSION_MAP } from "@/lib/auth-utils";

export default auth((req) => {
  const { nextUrl, auth } = req;
  const isLoggedIn = !!auth;

  const isPortalChangePassPage = nextUrl.pathname === "/portal/change-password";
  const isAdminPath = nextUrl.pathname.startsWith("/admin");
  const isPortalPath = nextUrl.pathname.startsWith("/portal/");
  const isConnectPath = nextUrl.pathname.startsWith("/portal/connect");

  // If user must change password, enforce it.
  if (isLoggedIn && auth.user.forceChangePass && !isPortalChangePassPage) {
    return NextResponse.redirect(new URL("/portal/change-password", nextUrl));
  }

  // If user is on change password page but doesn't need to be, redirect away.
  if (isLoggedIn && !auth.user.forceChangePass && isPortalChangePassPage) {
    return NextResponse.redirect(new URL("/portal/dashboard", nextUrl));
  }

  // Protect all non-auth and non-connect routes
  if (
    !isLoggedIn &&
    nextUrl.pathname !== "/" &&
    nextUrl.pathname !== "/login" &&
    !isConnectPath
  ) {
    let from = nextUrl.pathname;
    if (nextUrl.search) {
      from += nextUrl.search;
    }
    return NextResponse.redirect(new URL(`/login?from=${encodeURIComponent(from)}`, nextUrl));
  }
  
  if(isLoggedIn && (nextUrl.pathname === '/' || nextUrl.pathname === '/login')) {
      const isTenantOnly = auth.user.permissions?.length === 1 && auth.user.permissions[0] === 'portal:view';
      const redirectUrl = isTenantOnly ? '/portal/dashboard' : '/admin/dashboard';
      return NextResponse.redirect(new URL(redirectUrl, nextUrl));
  }

  // Enforce role-based access for admin pages
  if (isLoggedIn && isAdminPath) {
    const isSuperAdmin = auth.user.isSuperAdmin;
    if (isSuperAdmin) {
      return NextResponse.next(); // Super admin has access to everything
    }

    const userPermissions = new Set(auth.user.permissions || []);
    
    // Find a matching required permission for the current path
    const requiredPermission = Object.entries(PERMISSION_MAP).find(([pathPrefix]) => 
      nextUrl.pathname.startsWith(pathPrefix)
    )?.[1];

    if (requiredPermission && !userPermissions.has(requiredPermission)) {
      // User does not have permission, redirect with an error message
      const dashboardUrl = new URL("/admin/dashboard", nextUrl);
      dashboardUrl.searchParams.set("error", "You do not have permission to access that page.");
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // For all other cases, proceed with the request
  return NextResponse.next();
});

// Matcher to run the middleware on all routes except for static assets and API routes.
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|images).*)"],
};
