

import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';

const PORTAL_ACCESS_TOKEN_KEY = 'nibrental_portal_access_token'; // CORRECTED KEY
const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;

export async function POST(request: NextRequest) {
    const cookieStore = await cookies();
    const token = cookieStore.get(PORTAL_ACCESS_TOKEN_KEY)?.value;

    // Always clear the local cookie immediately
    cookieStore.set(PORTAL_ACCESS_TOKEN_KEY, '', { httpOnly: true, path: '/', maxAge: -1 });

    // The portal logout might not have a refresh token stored in the same way,
    // so we handle the case where only the access token is available.
    // The external server should handle invalidating the session with just the access token if possible.
    if (token && AUTH_API_BASE_URL) {
        try {
            fetch(`${AUTH_API_BASE_URL}/logout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                // Send what we have. The external server might only need the token from the header
                // and might not require a body for portal/simple token invalidation.
                // If refreshToken is mandatory, this would need adjustment based on how it's stored for portal users.
                body: JSON.stringify({ token: token, refreshToken: token }) // Sending token as refreshToken placeholder
            }).catch(e => console.error("Error calling external portal logout:", e.message));
        } catch (error) {
            console.error("Could not call external portal logout endpoint:", error);
        }
    }
    
    return NextResponse.json({ isSuccess: true, message: "Logged out successfully from portal." });
}
