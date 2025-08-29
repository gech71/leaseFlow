
// This route is no longer used by the application for updating user details.
// The logic has been moved directly into server actions for better reliability.
// This file can be safely deleted, but is kept to avoid breaking any potential external integrations.

import { NextResponse, type NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
    return NextResponse.json(
        { isSuccess: false, errors: ["This endpoint is deprecated. User updates are now handled by server actions."] },
        { status: 410 } // 410 Gone
    );
}
