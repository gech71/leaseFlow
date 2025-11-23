
import { auth } from "@/auth";
import { NextResponse, type NextRequest } from "next/server";
import { PERMISSION_MAP } from "@/lib/auth-utils";

// The ordered list of pages to check for redirection.
// More common/default pages should be higher up.
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
  // Add other pages as needed
];


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
    
    // Redirect tenants away from any admin page immediately
    if (userPermissions.size === 1 && userPermissions.has('portal:view')) {
      return NextResponse.redirect(new URL("/portal/dashboard", nextUrl));
    }
    
    // Find a matching required permission for the current path
    const requiredPermission = Object.entries(PERMISSION_MAP).find(([pathPrefix]) => 
      nextUrl.pathname.startsWith(pathPrefix)
    )?.[1];

    if (requiredPermission && !userPermissions.has(requiredPermission)) {
      // User does not have permission, find the first page they CAN access.
      const firstAllowedPage = ORDERED_ADMIN_PAGES.find(page => {
        const permission = PERMISSION_MAP[page];
        return permission && userPermissions.has(permission);
      });
      
      // If they have access to at least one page, redirect them there with an error.
      if (firstAllowedPage) {
        const redirectUrl = new URL(firstAllowedPage, nextUrl);
        redirectUrl.searchParams.set("error", "You do not have permission to access the requested page.");
        return NextResponse.redirect(redirectUrl);
      } else {
        // If the user has no admin permissions at all, redirect them away from admin.
        const loginUrl = new URL("/login", nextUrl);
        loginUrl.searchParams.set("error", "You do not have any assigned permissions to access the admin panel.");
        return NextResponse.redirect(loginUrl);
      }
    }
  }

  // For all other cases, proceed with the request
  return NextResponse.next();
});

// Matcher to run the middleware on all routes except for static assets and API routes.
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|images).*)"],
};
