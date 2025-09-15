
import { NextResponse, type NextRequest } from 'next/server';

// This endpoint is deprecated and its logic moved to server actions.
// This file is kept to prevent breaking any potential external integrations, but returns a 410 Gone status.
export async function POST(request: NextRequest) {
    return NextResponse.json(
        { isSuccess: false, errors: ["This API endpoint is deprecated. User updates are now handled by internal server actions."] },
        { status: 410 } // HTTP 410 Gone
    );
}

    