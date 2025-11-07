import { NextResponse } from 'next/server';
import { databaseService } from '@/lib/services/databaseService';

// This is a public-facing API to check for a user during login
// to see if they have a temporary password set.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('phone');

  if (!phone) {
    return NextResponse.json({ success: false, error: 'Phone number is required.' }, { status: 400 });
  }

  try {
    const user = await databaseService.findUserByPhoneNumber(phone);
    if (user) {
      return NextResponse.json({
        success: true,
        user: {
          tempPassword: !!user.tempPassword, // Return a boolean, not the password itself
        },
      });
    } else {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }
  } catch (error) {
    console.error("Error in /api/user/by-phone:", error);
    return NextResponse.json({ success: false, error: 'An internal server error occurred.' }, { status: 500 });
  }
}
