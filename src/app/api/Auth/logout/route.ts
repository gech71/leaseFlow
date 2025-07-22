
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';

const ADMIN_ACCESS_TOKEN_KEY = 'leaseflow_admin_access_token';
const ADMIN_REFRESH_TOKEN_KEY = 'leaseflow_admin_refresh_token';
const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;

export async function POST(request: NextRequest) {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_ACCESS_TOKEN_KEY)?.value;
    const refreshToken = cookieStore.get(ADMIN_REFRESH_TOKEN_KEY)?.value;

    // Always clear the local cookies
    cookieStore.set(ADMIN_ACCESS_TOKEN_KEY, '', { httpOnly: true, path: '/', maxAge: -1 });
    cookieStore.set(ADMIN_REFRESH_TOKEN_KEY, '', { httpOnly: true, path: '/', maxAge: -1 });

    if (token && refreshToken && AUTH_API_BASE_URL) {
        try {
            // Call the external identity server's logout endpoint.
            // This is "fire and forget" - we don't block the user's logout if it fails.
            fetch(`${AUTH_API_BASE_URL}/api/Auth/logout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ token, refreshToken })
            }).catch(e => console.error("Error calling external logout, but proceeding:", e.message));
        } catch (error) {
            console.error("Could not call external logout endpoint:", error);
        }
    }
    
    return NextResponse.json({ isSuccess: true, message: "Logged out successfully." });
}
