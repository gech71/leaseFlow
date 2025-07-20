
import { NextResponse, type NextRequest } from 'next/server';
import { databaseService } from '@/lib/services/databaseService';

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

    const responseData = await externalResponse.json();

    if (!externalResponse.ok) {
      return NextResponse.json(
        { isSuccess: false, errors: responseData.errors || ['Failed to reset password.'] },
        { status: externalResponse.status }
      );
    }

    // After a successful password reset, clear any temporary password stored locally.
    const user = await databaseService.findUserByPhoneNumber(phoneNumber);
    if (user && user.tempPassword) {
      await databaseService.updateUser(user.id, { tempPassword: null });
    }

    return NextResponse.json({ isSuccess: true, message: "Password has been reset successfully." });

  } catch (error: any) {
    console.error("Reset password error:", error);
    return NextResponse.json({ isSuccess: false, errors: ["An unexpected error occurred during the reset password process."] }, { status: 500 });
  }
}

    