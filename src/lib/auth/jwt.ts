import 'server-only';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import type { User, Role } from '@prisma/client';

const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;

// Define cookie names
const ACCESS_TOKEN_COOKIE_NAME = 'nibrental_access_token';
const REFRESH_TOKEN_COOKIE_NAME = 'nibrental_refresh_token';


if (!JWT_SECRET_KEY || JWT_SECRET_KEY.length !== 64) {
  const errorMessage = 'JWT_SECRET_KEY is not set or is not a 64-character hex string.';
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`FATAL: ${errorMessage} This is required for production.`);
  } else {
    console.warn(`WARN: ${errorMessage} The application will not be secure. Please generate a key for development.`);
  }
}

const key = new TextEncoder().encode(JWT_SECRET_KEY);

export interface SessionPayload extends JWTPayload {
  userId: string;
  email: string;
  permissions: string[];
  isSuperAdmin: boolean;
  forceChangePass: boolean;
}

export interface RefreshTokenPayload extends JWTPayload {
    userId: string;
}

/**
 * Encrypts session payloads and sets them as secure, HttpOnly cookies.
 * @param payload - The user session data to encrypt.
 */
export async function createSession(payload: Omit<SessionPayload, keyof JWTPayload>) {
  // Create Access Token (short-lived)
  const accessTokenExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  const accessToken = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(accessTokenExpires)
    .sign(key);

  cookies().set(ACCESS_TOKEN_COOKIE_NAME, accessToken, {
    expires: accessTokenExpires,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'lax',
  });

  // Create Refresh Token (long-lived)
  const refreshTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const refreshTokenPayload: RefreshTokenPayload = {
      userId: payload.userId,
  };
  const refreshToken = await new SignJWT(refreshTokenPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(refreshTokenExpires)
    .sign(key);

  cookies().set(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
    expires: refreshTokenExpires,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'lax',
  });
}

/**
 * Verifies the access token from the cookie and returns its payload.
 * @returns {Promise<SessionPayload | null>} The session payload or null if invalid.
 */
export async function verifySession(): Promise<SessionPayload | null> {
  const cookie = cookies().get(ACCESS_TOKEN_COOKIE_NAME)?.value;
  if (!cookie) return null;

  try {
    const { payload } = await jwtVerify(cookie, key, {
      algorithms: ['HS256'],
    });
    return payload as SessionPayload;
  } catch (error) {
    console.log("Failed to verify session (access token). It may be expired.");
    return null;
  }
}

/**
 * Verifies the refresh token from the cookie and returns its payload.
 * @returns {Promise<RefreshTokenPayload | null>} The refresh token payload or null if invalid.
 */
export async function verifyRefreshToken(): Promise<RefreshTokenPayload | null> {
    const cookie = cookies().get(REFRESH_TOKEN_COOKIE_NAME)?.value;
    if (!cookie) return null;
    
    try {
        const { payload } = await jwtVerify(cookie, key, {
            algorithms: ['HS256'],
        });
        return payload as RefreshTokenPayload;
    } catch (error) {
        console.log("Failed to verify refresh token.");
        return null;
    }
}


/**
 * Deletes the session cookies.
 */
export async function deleteSession() {
  cookies().delete(ACCESS_TOKEN_COOKIE_NAME);
  cookies().delete(REFRESH_TOKEN_COOKIE_NAME);
  cookies().delete('nibrental_csrf_token'); // Also clear the CSRF token
}

/**
 * Creates the payload for the JWT from the user object.
 * @param user - The user object from the database.
 * @returns The payload ready to be signed.
 */
export function createUserPayload(user: User & { roles: Role[] }): Omit<SessionPayload, keyof JWTPayload> {
  const isSuperAdmin = user.roles.some(role => role.name === 'SUPER_ADMIN');
  
  let permissions: string[] = [];
  if (!isSuperAdmin) {
    permissions = Array.from(new Set(user.roles.flatMap(role => role.permissions)));
  }

  return {
    userId: user.id,
    email: user.email,
    isSuperAdmin,
    permissions,
    forceChangePass: !!user.tempPassword, // Force change if temp password exists
  };
}
