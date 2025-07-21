
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

        const responseText = await externalResponse.text();

        if (!externalResponse.ok) {
            let errorMessages = ["Failed to initiate password reset."];
            if (responseText) {
                try {
                    const errorData = JSON.parse(responseText);
                    errorMessages = errorData?.errors || (errorData.message ? [errorData.message] : errorMessages);
                } catch (e) {
                    errorMessages = [responseText.substring(0, 150)];
                }
            }
            return NextResponse.json({ isSuccess: false, errors: errorMessages }, { status: externalResponse.status });
        }

        if (!responseText) {
             return NextResponse.json({ isSuccess: false, errors: ["Forgot password request was successful, but the server returned an empty response."] }, { status: 500 });
        }

        const responseData = JSON.parse(responseText);
        
        if (responseData.isSuccess && responseData.token) {
             return NextResponse.json({ isSuccess: true, token: responseData.token });
        }

        return NextResponse.json({ isSuccess: false, errors: ["Forgot password request failed or token was not provided."] }, { status: 500 });

    } catch (error) {
        console.error("Forgot password API call error:", error);
        return NextResponse.json({ isSuccess: false, errors: ["Could not connect to the authentication service."] }, { status: 503 });
    }
}
