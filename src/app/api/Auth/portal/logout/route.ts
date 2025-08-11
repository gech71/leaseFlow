// This file is no longer needed as logout is handled by /api/Auth/logout.
// It can be deleted, but returning a success response ensures any old clients don't break.

import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';

const ACCESS_TOKEN_KEY = 'leaseflow_admin_access_token';
const REFRESH_TOKEN_KEY = 'leaseflow_admin_refresh_token';
const PORTAL_ACCESS_TOKEN_KEY = 'leaseflow_portal_access_token';

export async function POST(request: NextRequest) {
    const cookieStore = await cookies();
    
    // Clear all possible session cookies for safety.
    cookieStore.set(ACCESS_TOKEN_KEY, '', { httpOnly: true, path: '/', maxAge: -1 });
    cookieStore.set(REFRESH_TOKEN_KEY, '', { httpOnly: true, path: '/', maxAge: -1 });
    cookieStore.set(PORTAL_ACCESS_TOKEN_KEY, '', { httpOnly: true, path: '/', maxAge: -1 });
    
    // Redirect to the main logout handler if needed, or just return success.
    // For simplicity, we just confirm logout. The main logout handler does the external call.
    return NextResponse.json({ isSuccess: true, message: "Logged out successfully from portal." });
}
