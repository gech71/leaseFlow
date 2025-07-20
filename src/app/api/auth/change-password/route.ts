
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { databaseService } from '@/lib/services/databaseService';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;
const PORTAL_ACCESS_TOKEN_KEY = 'leaseflow_portal_access_token';

export async function POST(request: NextRequest) {
  if (!AUTH_API_BASE_URL) {
    return NextResponse.json({ isSuccess: false, errors: ["Authentication service is not configured."] }, { status: 500 });
  }

  // 1. Verify user is authenticated to make this change
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(PORTAL_ACCESS_TOKEN_KEY)?.value;
  if (!accessToken) {
    return NextResponse.json({ isSuccess: false, errors: ["Authentication required."] }, { status: 401 });
  }

  let requestBody;
  try {
    requestBody = await request.json();
  } catch (e) {
    return NextResponse.json({ isSuccess: false, errors: ["Invalid request format."] }, { status: 400 });
  }

  const { phoneNumber, currentPassword, newPassword } = requestBody;

  if (!phoneNumber || !currentPassword || !newPassword) {
    return NextResponse.json({ isSuccess: false, errors: ["Phone number, current password, and new password are required."] }, { status: 400 });
  }

  try {
    const externalApiResponse = await fetch(`${AUTH_API_BASE_URL}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`, // Pass user's token for authorization
      },
      body: JSON.stringify({ phoneNumber, currentPassword, newPassword }),
    });

    const responseData = await externalApiResponse.json();

    if (!externalApiResponse.ok || !responseData.isSuccess) {
      const errorMessages = responseData?.errors || ["Failed to change password."];
      return NextResponse.json({ isSuccess: false, errors: errorMessages }, { status: externalApiResponse.status || 400 });
    }

    // If the password change was successful on the identity server,
    // clear the tempPassword field in the local database.
    const user = await databaseService.findUserByPhoneNumber(phoneNumber);
    if (user) {
      await databaseService.updateUser(user.id, { tempPassword: null });
    } else {
        console.warn(`Password changed for ${phoneNumber}, but user not found locally to clear temp password.`);
    }

    return NextResponse.json({ isSuccess: true, message: "Password changed successfully." });

  } catch (error: any) {
    console.error("Change password error:", error);
    return NextResponse.json({ isSuccess: false, errors: ["An unexpected error occurred."] }, { status: 500 });
  }
}
