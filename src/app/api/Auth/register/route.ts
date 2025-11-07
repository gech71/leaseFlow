

import { NextResponse, type NextRequest } from 'next/server';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma } from '@prisma/client'; // Import Prisma namespace for error types
import { sendEmail } from '@/lib/services/emailService';
import { auth } from '@/lib/auth';
import bcrypt from 'bcrypt';

export async function POST(request: NextRequest) {
  const session = await auth();
  
  if (!session?.user?.id) {
    return NextResponse.json({ isSuccess: false, errors: ["Authentication required."] }, { status: 401 });
  }

  // Verify requester has permission
  const adminUser = await databaseService.getUserById(session.user.id, { roles: true });
  if (!adminUser) {
    return NextResponse.json({ isSuccess: false, errors: ["Admin user not found in local system."] }, { status: 403 });
  }
  
  const isSuperAdmin = adminUser.roles.some(r => r.name === 'SUPER_ADMIN');
  const effectivePermissions = new Set<string>();
  adminUser.roles.forEach(role => {
      role.permissions.forEach(permission => effectivePermissions.add(permission));
  });
  const canRegisterUsers = isSuperAdmin || effectivePermissions.has('settings:user_registration:manage');

  if (!canRegisterUsers) {
    return NextResponse.json({ isSuccess: false, errors: ["Unauthorized: You do not have permission to register users."] }, { status: 403 });
  }

  // Get new user data from request body
  let newUserRegistrationData;
  try {
    newUserRegistrationData = await request.json();
  } catch (e) {
    return NextResponse.json({ isSuccess: false, errors: ["Invalid request format for new user."] }, { status: 400 });
  }

  const { firstName, lastName, phoneNumber, email, password } = newUserRegistrationData;

  if (!firstName || !lastName || !phoneNumber || !email || !password) {
    return NextResponse.json({ isSuccess: false, errors: ["Missing required fields for user registration."] }, { status: 400 });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const userCreateInput: Prisma.UserCreateInput = {
      email: email,
      name: `${firstName} ${lastName}`.trim(),
      firstName: firstName,
      lastName: lastName,
      phoneNumber: phoneNumber,
      password: hashedPassword,
      tempPassword: password, // Store original password temporarily for admin display
      createdBy: { connect: { id: adminUser.id } },
    };

    const localUser = await databaseService.createUser(userCreateInput);

     const emailHtml = `
      <h1>Welcome to nibrental!</h1>
      <p>Hello ${firstName},</p>
      <p>A new account has been created for you. You can now log in with the credentials provided by your administrator.</p>
      <p>You can access the portal here: <a href="https://nibrental.nibbank.com.et/login">https://nibrental.nibbank.com.et/login</a></p>
      <p><strong>Login Phone Number:</strong> ${phoneNumber}</p>
      <p>Thank you,</p>
      <p>The Management Team</p>
    `;

    await sendEmail({
      to: email,
      subject: 'Your New Account Credentials',
      html: emailHtml
    });
    
    return NextResponse.json({ isSuccess: true, message: "User registered successfully.", userId: localUser.id });

  } catch (dbError: any) {
    console.error("Error creating user in local database:", dbError);
    if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === 'P2002') {
         const target = (dbError.meta?.target as string[]) || [];
         return NextResponse.json({ isSuccess: false, errors: [`A user with this ${target.join(', ')} already exists.`] }, { status: 409 });
    }
    return NextResponse.json({ isSuccess: false, errors: ["Failed to create local user record.", dbError.message] }, { status: 500 });
  }
}
