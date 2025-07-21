
import { NextResponse, type NextRequest } from 'next/server';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;

export async function POST(request: NextRequest) {
  if (!AUTH_API_BASE_URL) {
    console.error("Authentication service URL (NEXT_PUBLIC_AUTH_API_BASE_URL) is not configured.");
    return NextResponse.json({ isSuccess: false, errors: ["Password reset service is not configured."] }, { status: 500 });
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
      return NextResponse.json(
        { isSuccess: false, errors: responseData.errors || ['Failed to initiate password reset.'] },
        { status: externalResponse.status }
      );
    }
    
    // Assuming the external API returns { isSuccess: true, token: "..." }
    // This endpoint now directly returns the token to the client.
    return NextResponse.json(responseData);

  } catch (error: any) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ isSuccess: false, errors: ["An unexpected error occurred during the forgot password process."] }, { status: 500 });
  }
}
