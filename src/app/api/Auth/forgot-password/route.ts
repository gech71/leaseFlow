
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
        
        // Handle cases where success is indicated by status code but body might be empty
        if (!responseText) {
            // It's possible the token is sent via SMS and the API just confirms success.
            return NextResponse.json({ isSuccess: true, message: "Request received. If your number is valid, you will receive a reset code." });
        }

        let responseData;
        try {
            responseData = JSON.parse(responseText);
        } catch (e) {
            console.error("Forgot password API call successful, but failed to parse JSON response from identity server.", responseText);
            // Even if we can't parse, we can tell the user to check their phone.
            return NextResponse.json({ isSuccess: true, message: "Request received. If your number is valid, you will receive a reset code." });
        }
        
        // If we successfully parsed, check for token and success status.
        if (responseData.isSuccess && responseData.token) {
             return NextResponse.json({ isSuccess: true, token: responseData.token });
        }
        
        // The identity server might just return `isSuccess: true` if the token is sent via another channel
        if (responseData.isSuccess) {
            return NextResponse.json({ isSuccess: true, message: responseData.message || "Request received." });
        }
        
        // Fallback for any other scenario
        return NextResponse.json({ isSuccess: false, errors: responseData.errors || ["Forgot password request failed or token was not provided."] }, { status: 500 });

    } catch (error) {
        console.error("Forgot password API call error:", error);
        return NextResponse.json({ isSuccess: false, errors: ["Could not connect to the authentication service."] }, { status: 503 });
    }
}
