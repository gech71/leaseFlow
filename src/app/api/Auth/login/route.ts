
import { NextResponse, type NextRequest } from 'next/server';
import { signIn } from '@/lib/auth';
import { databaseService } from '@/lib/services/databaseService';

export async function POST(request: NextRequest) {
  try {
    const credentials = await request.json();
    const { phoneNumber, password } = credentials;

    if (!phoneNumber || !password) {
      return NextResponse.json({ isSuccess: false, errors: ["Phone number and password are required."] }, { status: 400 });
    }

    const user = await databaseService.findUserByPhoneNumber(phoneNumber, {
        roles: true,
    });
    
    // Perform preliminary checks before attempting signIn
    if (!user) {
        return NextResponse.json({ isSuccess: false, errors: ["Invalid credentials."] }, { status: 401 });
    }

    const isTenantOnly = user.roles.length === 1 && user.roles[0].name === 'TENANT';
    if (isTenantOnly) {
        const tenantProfile = await databaseService.findTenantByEmailOrPhone(user.email, user.phoneNumber);
        if (tenantProfile && tenantProfile.status === 'Inactive') {
            return NextResponse.json({ isSuccess: false, errors: ["Your account is inactive. Please contact property management."] }, { status: 403 });
        }
    }

    // Now, attempt to sign in using NextAuth's logic
    await signIn("credentials", {
      redirect: false,
      phoneNumber,
      password,
    });
    
    // If signIn throws an error, the catch block will handle it.
    // If it succeeds, we proceed. Note that NextAuth handles setting the cookie.
    const redirectPath = isTenantOnly ? '/portal/dashboard' : '/admin/dashboard';
    
    return NextResponse.json({ 
        isSuccess: true, 
        redirectPath: redirectPath,
        requiresPasswordChange: !!user.tempPassword,
    });

  } catch (error: any) {
    if (error.type === 'CredentialsSignin') {
        // This error is thrown by NextAuth for failed credential validation
        return NextResponse.json({ isSuccess: false, errors: ['Invalid credentials.'] }, { status: 401 });
    }

    console.error("Login API Error:", error);
    return NextResponse.json({ isSuccess: false, errors: ['An unexpected server error occurred.'] }, { status: 500 });
  }
}
