
import { NextResponse, type NextRequest } from 'next/server';

const VALIDATE_TOKEN_URL = process.env.NIB_VALIDATE_TOKEN_URL;

export async function GET(request: NextRequest) {
  // 1. Check if the external validation URL is configured
  if (!VALIDATE_TOKEN_URL) {
    console.error("Token validation service URL (NIB_VALIDATE_TOKEN_URL) is not configured.");
    return NextResponse.json({ isSuccess: false, errors: ["Token validation service is not available."] }, { status: 503 });
  }

  // 2. Extract and validate the Authorization header
  const authHeader = request.headers.get('Authorization');

  if (!authHeader) {
    return NextResponse.json({ isSuccess: false, errors: ["Authorization header is missing."] }, { status: 401 });
  }

  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ isSuccess: false, errors: ["Authorization header is malformed. It must start with 'Bearer'."] }, { status: 401 });
  }

  const token = authHeader.substring(7);
  if (!token) {
    return NextResponse.json({ isSuccess: false, errors: ["Token is missing from the Authorization header."] }, { status: 401 });
  }

  // 3. Call the external validation service
  try {
    const externalResponse = await fetch(VALIDATE_TOKEN_URL, {
      method: 'GET',
      headers: {
        'Authorization': authHeader, // Forward the entire header
        'Accept': 'application/json',
      },
    });

    const responseText = await externalResponse.text();

    if (!externalResponse.ok) {
        let errorData;
        try {
            errorData = responseText ? JSON.parse(responseText) : {};
        } catch (e) {
             console.error(`External token validation failed with status ${externalResponse.status} and non-JSON body:`, responseText);
             return NextResponse.json({ isSuccess: false, errors: ['Token validation failed with an unreadable response.'] }, { status: externalResponse.status });
        }
        console.error(`External token validation failed with status ${externalResponse.status}:`, errorData);
        return NextResponse.json(
            { isSuccess: false, errors: errorData?.errors || ['Token validation failed.'], details: errorData },
            { status: externalResponse.status }
        );
    }
    
    if (!responseText) {
        console.error(`External token validation returned status ${externalResponse.status} with an empty body.`);
        return NextResponse.json({ isSuccess: false, errors: ['Token validation failed with an empty response from the server.'] }, { status: 500 });
    }

    let responseData;
    try {
        responseData = JSON.parse(responseText);
    } catch (e) {
        console.error("External validation success, but failed to parse JSON response:", responseText);
        return NextResponse.json({ isSuccess: false, errors: ["Received an invalid response from the validation server."] }, { status: 500 });
    }

    const phoneNumber = responseData.phone;
    if (!phoneNumber) {
        console.error("External validation success, but 'phone' field is missing in the response:", responseData);
        return NextResponse.json({ isSuccess: false, errors: ["Validation successful, but phone number was not returned."] }, { status: 500 });
    }

    // On success, return only the phone number as specified
    return NextResponse.json({ phone: phoneNumber });

  } catch (error: any) {
    console.error("Network error or other exception during token validation:", error.message);
    if (error.name === 'FetchError') {
       return NextResponse.json({ isSuccess: false, errors: ["Could not connect to the token validation service."] }, { status: 503 });
    }
    return NextResponse.json({ isSuccess: false, errors: ["An unexpected error occurred during token validation."] }, { status: 500 });
  }
}
