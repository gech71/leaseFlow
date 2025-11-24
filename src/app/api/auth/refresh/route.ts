
import { NextResponse, type NextRequest } from 'next/server';
import { verifyRefreshToken, createSession, createUserPayload } from '@/lib/auth/jwt';
import { databaseService } from '@/lib/services/databaseService';

export async function POST(request: NextRequest) {
    const refreshTokenPayload = await verifyRefreshToken();

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
    await createSession(newSessionPayload);

    return NextResponse.json({ message: "Session refreshed successfully." }, { status: 200 });
}
