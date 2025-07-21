
import { NextResponse, type NextRequest } from 'next/server';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;

export async function POST(request: NextRequest) {
    if (!AUTH_API_BASE_URL) {
        console.error("Auth API base URL is not configured.");
        return NextResponse.json({ isSuccess: false, errors: ["Authentication service is not configured."] }, { status: 500 });
    }

    let requestBody;
    try {
        requestBody = await request.json();
    } catch (e) {
        return NextResponse.json({ isSuccess: false, errors: ["Invalid request format."] }, { status: 400 });
    }

    const { phoneNumber } = requestBody;
    if (!phoneNumber) {
        return NextResponse.json({ isSuccess: false, errors: ["Phone number is required."] }, { status: 400 });
    }

    try {
        const externalResponse = await fetch(`${AUTH_API_BASE_URL}/api/Auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber }),
        });

        const responseData = await externalResponse.json();

        if (!externalResponse.ok) {
            const errorMessages = responseData?.errors || ["Failed to initiate password reset."];
            return NextResponse.json({ isSuccess: false, errors: errorMessages }, { status: externalResponse.status });
        }
        
        // The external service is expected to return a token on success
        if (responseData.isSuccess && responseData.token) {
             return NextResponse.json({ isSuccess: true, token: responseData.token });
        }

        return NextResponse.json({ isSuccess: false, errors: ["Forgot password request failed or token was not provided."] }, { status: 500 });

    } catch (error) {
        console.error("Forgot password API call error:", error);
        return NextResponse.json({ isSuccess: false, errors: ["Could not connect to the authentication service."] }, { status: 503 });
    }
}
