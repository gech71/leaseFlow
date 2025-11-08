
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { databaseService } from '@/lib/services/databaseService';
import bcrypt from 'bcrypt';
import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth/next';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, errors: ["Authentication required."] }, { status: 401 });
  }

  let requestBody;
  try {
    requestBody = await request.json();
  } catch (e) {
    return NextResponse.json({ isSuccess: false, errors: ["Invalid request format."] }, { status: 400 });
  }

  const { currentPassword, newPassword } = requestBody;

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ isSuccess: false, errors: ["Current and new passwords are required."] }, { status: 400 });
  }

  const localUser = await databaseService.getUserById(session.user.id);

  if (!localUser || !localUser.password) {
    return NextResponse.json({ isSuccess: false, errors: ["User not found or password is not set."] }, { status: 404 });
  }

  const isPasswordValid = await bcrypt.compare(currentPassword, localUser.password);

  if (!isPasswordValid) {
    return NextResponse.json({ isSuccess: false, errors: ["The current password you entered is incorrect."] }, { status: 400 });
  }

  try {
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await databaseService.updateUser(localUser.id, {
      password: hashedNewPassword,
      tempPassword: null, // Clear any temporary password
    });

    return NextResponse.json({ isSuccess: true, message: "Password changed successfully." });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json({ isSuccess: false, errors: ["An internal error occurred while updating the password."] }, { status: 500 });
  }
}
