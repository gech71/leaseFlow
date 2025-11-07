
import { NextResponse } from 'next/server';

// This endpoint is deprecated and its logic moved to a server action.
// This file is kept to prevent breaking any potential external integrations, but returns a 410 Gone status.
export async function POST(request: Request) {
    return NextResponse.json(
        { isSuccess: false, errors: ["This API endpoint is deprecated. Password resets are now handled by an internal server action in the User Management settings."] },
        { status: 410 } // HTTP 410 Gone
    );
}
