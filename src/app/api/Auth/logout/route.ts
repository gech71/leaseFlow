
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';

const ADMIN_ACCESS_TOKEN_KEY = 'leaseflow_admin_access_token';
const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;

export async function POST(request: NextRequest) {
    const cookieStore = cookies();
    const token = cookieStore.get(ADMIN_ACCESS_TOKEN_KEY)?.value;

    // Always clear the local cookie
    cookieStore.set(ADMIN_ACCESS_TOKEN_KEY, '', { httpOnly: true, path: '/', maxAge: -1 });

    if (token && AUTH_API_BASE_URL) {
        try {
            // Call the external identity server's logout endpoint.
            // This is "fire and forget" - we don't block the user's logout if it fails.
            fetch(`${AUTH_API_BASE_URL}/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }).catch(e => console.error("Error calling external logout, but proceeding:", e.message));
        } catch (error) {
            console.error("Could not call external logout endpoint:", error);
        }
    }
    
    return NextResponse.json({ isSuccess: true, message: "Logged out successfully." });
}
