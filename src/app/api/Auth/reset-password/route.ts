
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

    const { phoneNumber, token, newPassword } = requestBody;
    if (!phoneNumber || !token || !newPassword) {
        return NextResponse.json({ isSuccess: false, errors: ["Phone number, token, and new password are required."] }, { status: 400 });
    }

    try {
        const externalResponse = await fetch(`${AUTH_API_BASE_URL}/api/Auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber, token, newPassword }),
        });

        const responseText = await externalResponse.text();

        if (!externalResponse.ok) {
            let errorMessages = ["Failed to reset password."];
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
        
        // Even on success, some APIs might return an empty body.
        // If there's no text, we can assume success based on the OK status.
        if (!responseText) {
            return NextResponse.json({ isSuccess: true, message: "Password has been reset successfully." });
        }

        // If there is a response body, parse it and return.
        const responseData = JSON.parse(responseText);
        return NextResponse.json({ isSuccess: true, ...responseData });

    } catch (error) {
        console.error("Reset password API call error:", error);
        return NextResponse.json({ isSuccess: false, errors: ["Could not connect to the authentication service."] }, { status: 503 });
    }
}
