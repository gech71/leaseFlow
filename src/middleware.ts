import { NextResponse, type NextRequest } from "next/server";
import {
  verifySession,
  ACCESS_TOKEN_COOKIE_NAME,
  CSRF_TOKEN_COOKIE_NAME,
  CSRF_TOKEN_SIG_NAME,
  signCsrfToken,
  verifyCsrfToken,
  getSessionCookieNames,
  LAST_ACTIVE_COOKIE_NAME,
  SESSION_ID_COOKIE_NAME,
  IDLE_TIMEOUT_MS,
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

  const csp = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'unsafe-inline';
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' data:;
    font-src 'self' https://fonts.gstatic.com;
    frame-ancestors 'none';
    connect-src 'self';
    frame-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
  `
    .replace(/\s{2,}/g, " ")
    .trim();
  response.headers.set("Content-Security-Policy", csp);

  // --- CSRF Token ---
  const csrfToken = request.cookies.get(CSRF_TOKEN_COOKIE_NAME)?.value;
  const csrfSig = request.cookies.get(CSRF_TOKEN_SIG_NAME)?.value;
  if (!csrfToken || !csrfSig || !(await verifyCsrfToken(csrfToken, csrfSig))) {
    const tokenValue = nanoid(32);
    const sigValue = await signCsrfToken(tokenValue);
    response.cookies.set(CSRF_TOKEN_COOKIE_NAME, tokenValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
    });
    response.cookies.set(CSRF_TOKEN_SIG_NAME, sigValue, {
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

  // If a valid session was returned, ensure the browser's session-id cookie
  // matches the token's JTI. If it doesn't, this indicates token misuse
  // (copied/modified token) and we should revoke and force logout.
  if (session) {
    try {
      const sessionCookie = request.cookies.get(SESSION_ID_COOKIE_NAME)?.value;
      // Compute expected signed session cookie from the token's jti
      const { signSessionCookie } = await import("@/lib/auth/jwt");
      const expected = session.jti
        ? await signSessionCookie(session.jti)
        : null;
      if (
        session.jti &&
        sessionCookie &&
        expected &&
        sessionCookie !== expected
      ) {
        try {
          const { databaseService } = await import(
            "@/lib/services/databaseService"
          );
          // Revoke the session represented by this token JTI
          await databaseService.revokeUserSessionByJti(session.jti);
          const user = await databaseService.getUserById(session.userId);
          if (user) {
            await databaseService.updateUser(user.id, {
              currentAccessJti: null,
              currentRefreshJti: null,
            } as any);
          }
        } catch (err) {
          // ignore DB errors
        }

        const cookieNames = getSessionCookieNames();
        if (pathname.startsWith("/api/")) {
          const resp = NextResponse.json(
            { message: "Unauthorized. Token mismatch detected." },
            { status: 401 },
          );
          cookieNames.forEach((name) =>
            resp.cookies.set(name, "", { expires: new Date(0), path: "/" }),
          );
          return resp;
        }

        const resp = NextResponse.redirect(new URL("/login", request.url));
        cookieNames.forEach((name) =>
          resp.cookies.set(name, "", { expires: new Date(0), path: "/" }),
        );
        return resp;
      }
    } catch (err) {
      // ignore
    }
  }

  if (!session) {
    // If verifySession returned null, try to decode the token to see if it's
    // a valid JWT whose JTI no longer matches the user's stored JTI. This
    // indicates possible token reuse/tampering. In that case, revoke the
    // session server-side and clear cookies so the affected user is force-logged-out.
    try {
      const payload = await (
        await import("@/lib/auth/jwt")
      ).decodeJwt(accessToken);
      if (payload && (payload as any).jti && (payload as any).userId) {
        try {
          const { databaseService } = await import(
            "@/lib/services/databaseService"
          );
          const user = await databaseService.getUserById(
            (payload as any).userId,
          );
          if (
            user &&
            user.currentAccessJti &&
            user.currentAccessJti !== (payload as any).jti
          ) {
            // Tampering / reuse detected. Revoke session and clear stored JTIs.
            await databaseService.revokeUserSessionByJti((payload as any).jti);
            await databaseService.updateUser(user.id, {
              currentAccessJti: null,
              currentRefreshJti: null,
            } as any);

            const cookieNames = getSessionCookieNames();
            if (pathname.startsWith("/api/")) {
              const resp = NextResponse.json(
                { message: "Unauthorized. Token mismatch detected." },
                { status: 401 },
              );
              cookieNames.forEach((name) =>
                resp.cookies.set(name, "", { expires: new Date(0), path: "/" }),
              );
              return resp;
            }
            const resp = NextResponse.redirect(new URL("/login", request.url));
            cookieNames.forEach((name) =>
              resp.cookies.set(name, "", { expires: new Date(0), path: "/" }),
            );
            return resp;
          }
        } catch (err) {
          // DB checks failed; fall through to normal redirect below.
        }
      }
    } catch (err) {
      // ignore decode errors and continue with standard redirect
    }
    const loginUrl = new URL("/login", request.url);
    // For API requests, return 401 JSON so clients can handle logout.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { message: "Unauthorized. Please log in." },
        { status: 401 },
      );
    }
    // Redirect to plain /login on session expiration for page navigations
    return NextResponse.redirect(loginUrl);
  }

  // --- Idle timeout enforcement ---
  try {
    const lastActive = request.cookies.get(LAST_ACTIVE_COOKIE_NAME)?.value;
    const now = Date.now();
    if (!lastActive || now - Number(lastActive) > IDLE_TIMEOUT_MS) {
      // Treat this as session expired due to inactivity.
      const cookieNames = getSessionCookieNames();
      if (pathname.startsWith("/api/")) {
        const resp = NextResponse.json(
          { message: "Session expired due to inactivity." },
          { status: 401 },
        );
        cookieNames.forEach((name) =>
          resp.cookies.set(name, "", { expires: new Date(0), path: "/" }),
        );
        return resp;
      }
      const resp = NextResponse.redirect(new URL("/login", request.url));
      cookieNames.forEach((name) =>
        resp.cookies.set(name, "", { expires: new Date(0), path: "/" }),
      );
      return resp;
    }

    // Update last-active cookie to extend idle timeout
    response.cookies.set(LAST_ACTIVE_COOKIE_NAME, String(now), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
    });
  } catch (err) {
    // If anything goes wrong reading/updating last-active, continue without blocking.
  }

  // --- Priority #1: Handle forced password change ---
  if (session.forceChangePass) {
    if (pathname !== "/change-password") {
      return NextResponse.redirect(new URL("/change-password", request.url));
    }
    return response;
  }
  // If user is NOT forced to change password but tries to access the page, redirect away.
  if (pathname === "/change-password") {
    return NextResponse.redirect(new URL("/admin/dashboard", request.url));
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
          firstAllowedPage ? "Access Denied" : "Access Denied",
        );
        return NextResponse.redirect(redirectUrl);
      }
    }
  }

  // Handle Portal Routes
  if (pathname.startsWith("/portal/") && !isPublicRoute) {
    if (!isTenantOnly) {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/image|favicon.ico|images).*)"],
};
