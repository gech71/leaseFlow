import { NextResponse, type NextRequest } from 'next/server';
import { verifyRefreshToken, createSession, createUserPayload, REFRESH_TOKEN_COOKIE_NAME } from '@/lib/auth/jwt';
import { databaseService } from '@/lib/services/databaseService';

export async function POST(request: NextRequest) {
    const refreshTokenFromCookie = request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)?.value;
    const refreshTokenPayload = await verifyRefreshToken(refreshTokenFromCookie);

    if (!refreshTokenPayload) {
        return NextResponse.json({ message: "Unauthorized. Invalid refresh token." }, { status: 401 });
    }

    // Token is valid, get fresh user data to create a new session
    const user = await databaseService.getUserById(refreshTokenPayload.userId, {
        roles: true,
    });

    if (!user) {
        return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    // Create a new session (which includes a new access token and a new refresh token)
    const newSessionPayload = createUserPayload(user);
    const { accessToken, refreshToken } = await createSession(newSessionPayload);

    const response = NextResponse.json({ message: "Session refreshed successfully." }, { status: 200 });
    
    // Set the new cookies
    response.cookies.set(accessToken.name, accessToken.value, accessToken.options);
    response.cookies.set(refreshToken.name, refreshToken.value, refreshToken.options);

    return response;
}