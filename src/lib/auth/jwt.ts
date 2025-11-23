import 'server-only';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import type { User, Role } from '@prisma/client';

const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;
const JWT_COOKIE_NAME = process.env.JWT_COOKIE_NAME || 'nibrental_session';

if (!JWT_SECRET_KEY) {
  throw new Error('FATAL: JWT_SECRET_KEY is not set in the environment variables.');
}

const key = new TextEncoder().encode(JWT_SECRET_KEY);

export interface SessionPayload extends JWTPayload {
  userId: string;
  email: string;
  permissions: string[];
  isSuperAdmin: boolean;
  forceChangePass: boolean;
}

/**
 * Encrypts a session payload and sets it as a secure, an HttpOnly cookie.
 * @param payload - The user session data to encrypt.
 */
export async function createSession(payload: SessionPayload) {
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
  
  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(key);

  cookies().set(JWT_COOKIE_NAME, jwt, {
    expires,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'lax',
  });
}

/**
 * Verifies the session from the cookie and returns its payload.
 * @returns {Promise<SessionPayload | null>} The session payload or null if invalid.
 */
export async function verifySession(): Promise<SessionPayload | null> {
  const cookie = cookies().get(JWT_COOKIE_NAME)?.value;
  if (!cookie) return null;

  try {
    const { payload } = await jwtVerify(cookie, key, {
      algorithms: ['HS256'],
    });
    return payload as SessionPayload;
  } catch (error) {
    console.log("Failed to verify session:", (error as Error).message);
    return null;
  }
}

/**
 * Deletes the session cookie.
 */
export async function deleteSession() {
  cookies().delete(JWT_COOKIE_NAME);
}

/**
 * Creates the payload for the JWT from the user object.
 * @param user - The user object from the database.
 * @returns {SessionPayload} The payload ready to be signed.
 */
export function createUserPayload(user: User & { roles: Role[] }): Omit<SessionPayload, keyof JWTPayload> {
  const isSuperAdmin = user.roles.some(role => role.name === 'SUPER_ADMIN');
  
  let permissions: string[] = [];
  if (!isSuperAdmin) {
    permissions = user.roles.flatMap(role => role.permissions);
  }

  return {
    userId: user.id,
    email: user.email,
    isSuperAdmin,
    permissions,
    forceChangePass: !!user.tempPassword, // Force change if temp password exists
  };
}
