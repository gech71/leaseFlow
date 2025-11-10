
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';

const PORTAL_ACCESS_TOKEN_KEY = 'nibrental_portal_access_token';
const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;

export async function POST(request: NextRequest) {
    const cookieStore = await cookies();
    const token = cookieStore.get(PORTAL_ACCESS_TOKEN_KEY)?.value;

    cookieStore.set(PORTAL_ACCESS_TOKEN_KEY, '', { httpOnly: true, path: '/', maxAge: -1 });

    if (token && AUTH_API_BASE_URL) {
        try {
            fetch(`${AUTH_API_BASE_URL}/logout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ token: token, refreshToken: token })
            }).catch(e => console.error("Error calling external portal logout:", e.message));
        } catch (error) {
            console.error("Could not call external portal logout endpoint:", error);
        }
    }
    
    return NextResponse.json({ isSuccess: true, message: "Logged out successfully from portal." });
}
