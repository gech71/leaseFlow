
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
        
        let responseData;
        try {
            responseData = JSON.parse(responseText);
        } catch (e) {
            console.error("Forgot password API call successful, but failed to parse JSON response from identity server.", responseText);
            return NextResponse.json({ isSuccess: false, errors: ["Received an invalid response from the authentication service."] }, { status: 500 });
        }
        
        // If we successfully parsed, check for token and success status.
        if (responseData.isSuccess && responseData.token) {
             return NextResponse.json({ isSuccess: true, token: responseData.token });
        }
        
        // The identity server might just return `isSuccess: true` if the token is sent via another channel
        if (responseData.isSuccess && !responseData.token) {
            return NextResponse.json({ isSuccess: false, errors: ["Forgot password request was successful, but a token was not provided by the service."] }, { status: 500 });
        }
        
        // Fallback for any other scenario, including isSuccess: false from the identity server
        return NextResponse.json({ isSuccess: false, errors: responseData.errors || ["Forgot password request failed or token was not provided."] }, { status: 500 });

    } catch (error) {
        console.error("Forgot password API call error:", error);
        return NextResponse.json({ isSuccess: false, errors: ["Could not connect to the authentication service."] }, { status: 503 });
    }
}
