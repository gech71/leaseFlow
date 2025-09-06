
'use server';

import { cookies } from 'next/headers';

const PORTAL_ACCESS_TOKEN_KEY = 'nibrental_admin_access_token'; // Use the unified admin token key
const PORTAL_ACCESS_TOKEN_MAX_AGE = 60 * 60; // 1 hour

export async function setPortalSessionAction(token: string): Promise<{ success: boolean }> {
  if (!token) {
    return { success: false };
  }
  try {
    const cookieStore = await cookies();
    cookieStore.set(PORTAL_ACCESS_TOKEN_KEY, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
      maxAge: PORTAL_ACCESS_TOKEN_MAX_AGE,
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to set portal session cookie:", error);
    return { success: false };
  }
}
