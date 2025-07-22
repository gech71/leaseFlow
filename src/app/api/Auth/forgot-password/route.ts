
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
        
        // --- Corrected Logic ---
        // The token is embedded in the 'message' field.
        const message = responseData.message;
        if (typeof message === 'string' && message.includes(': ')) {
            const token = message.split(': ').pop()?.trim();
            if (token) {
                return NextResponse.json({ isSuccess: true, token: token });
            }
        }
        
        // This will now be the error case if the token isn't found in the message.
        return NextResponse.json({ isSuccess: false, errors: ["Forgot password request was successful, but a token was not provided in the expected format."] }, { status: 500 });

    } catch (error) {
        console.error("Forgot password API call error:", error);
        return NextResponse.json({ isSuccess: false, errors: ["Could not connect to the authentication service."] }, { status: 503 });
    }
}
