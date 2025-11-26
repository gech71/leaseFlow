
import { NextResponse, type NextRequest } from "next/server";
import {
  verifySession,
  ACCESS_TOKEN_COOKIE_NAME,
  CSRF_TOKEN_COOKIE_NAME,
} from "@/lib/auth/jwt";
import { PERMISSION_MAP } from "@/lib/auth-utils";
import { nanoid } from "nanoid";

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
];

const PUBLIC_ROUTES = [
  "/login",
  "/portal/connect",
  "/portal/cancel",
  "/portal/error",
  "/api/portal/payment-callback",
  "/api/portal/Arifcallback",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let response = NextResponse.next();

  // --- Apply CSP ---
  const nonce = nanoid(16);
  response.headers.set("x-nonce", nonce);
  // NOTE: In a real production environment, this CSP would need to be more restrictive.
  // For this project, we'll keep it broad to avoid breaking TinyMCE or other potential libraries.
  const csp = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' https://cdn.tiny.cloud 'unsafe-inline';
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.tiny.cloud;
    img-src 'self' data: https://cdn.tiny.cloud;
    font-src 'self' https://fonts.gstatic.com;
    frame-ancestors 'none';
    connect-src 'self';
    frame-src 'self' https://cdn.tiny.cloud;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
  `
    .replace(/\s{2,}/g, " ")
    .trim();
  response.headers.set("Content-Security-Policy", csp);

  // --- CSRF Token ---
  const csrfToken = request.cookies.get(CSRF_TOKEN_COOKIE_NAME)?.value;
  if (!csrfToken) {
    response.cookies.set(CSRF_TOKEN_COOKIE_NAME, nanoid(32), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
    });
  }

  // Skip auth checks for static files
  if (pathname.includes(".") && !pathname.startsWith("/api")) {
    return response;
  }

  const isPublicRoute =
    PUBLIC_ROUTES.some((path) => pathname.startsWith(path)) || pathname === "/";
  const isApiAuthRoute = pathname.startsWith("/api/auth");

  if (isPublicRoute || isApiAuthRoute) {
    return response;
  }

  // --- Verify Session ---
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE_NAME)?.value;
  const session = await verifySession(accessToken);

  if (!session) {
    let from = pathname;
    if (request.nextUrl.search) {
      from += request.nextUrl.search;
    }
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/login" && pathname !== "/") {
      loginUrl.searchParams.set("from", from);
    }
    loginUrl.searchParams.set("error", "session_expired");
    return NextResponse.redirect(loginUrl);
  }

  // --- Priority #1: Handle forced password change ---
  if (session.forceChangePass) {
    // If user needs to change password, they can ONLY go to the change password page.
    if (!pathname.startsWith("/portal/change-password")) {
      return NextResponse.redirect(
        new URL("/portal/change-password", request.url),
      );
    }
    // If they are already on the change password page, allow it.
    return response; 
  }
  // If user is NOT forced to change password but tries to access the page, redirect away.
  if (pathname.startsWith("/portal/change-password")) {
    return NextResponse.redirect(new URL("/portal/dashboard", request.url));
  }


  // --- Role-based Routing Logic ---
  const userPermissions = new Set(session.permissions);
  const isTenantOnly =
    userPermissions.has("portal:view") &&
    userPermissions.size === 1 &&
    !session.isSuperAdmin;

  // Handle Admin Routes
  if (pathname.startsWith("/admin")) {
    if (isTenantOnly) {
      return NextResponse.redirect(new URL("/portal/dashboard", request.url));
    }

    if (!session.isSuperAdmin) {
      const requiredPermission = Object.entries(PERMISSION_MAP).find(
        ([pathPrefix]) => pathname.startsWith(pathPrefix),
      )?.[1];

      if (requiredPermission && !userPermissions.has(requiredPermission)) {
        const firstAllowedPage = ORDERED_ADMIN_PAGES.find((page) => {
          const permission = PERMISSION_MAP[page];
          return permission && userPermissions.has(permission);
        });

        const redirectUrl = new URL(firstAllowedPage || "/login", request.url);
        redirectUrl.searchParams.set(
          "error",
          firstAllowedPage
            ? "You do not have permission to access the requested page."
            : "You do not have any assigned permissions to access the admin panel.",
        );
        return NextResponse.redirect(redirectUrl);
      }
    }
  }

  // Handle Portal Routes
  if (
    pathname.startsWith("/portal/") &&
    !isPublicRoute &&
    !pathname.startsWith("/portal/change-password") // Add this exception
  ) {
    if (!isTenantOnly) {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/image|favicon.ico|images).*)"],
};
