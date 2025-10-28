

import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma } from '@prisma/client'; // Import Prisma namespace for error types
import { sendEmail } from '@/lib/services/emailService';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;
const ADMIN_ACCESS_TOKEN_KEY = 'nibrental_admin_access_token';

// Insecure JWT payload decoder for prototype purposes ONLY.
// DO NOT USE IN PRODUCTION. Use a proper JWT library (e.g., jose).
function decodeJwtPayload(token: string): any | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Failed to decode JWT payload:', e);
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (!AUTH_API_BASE_URL) {
    console.error("Authentication service URL (NEXT_PUBLIC_AUTH_API_BASE_URL) is not configured.");
    return NextResponse.json({ isSuccess: false, errors: ["User registration service is not configured."] }, { status: 500 });
  }

  // 1. Verify requester has permission
  const cookieStore = await cookies();
  const adminAccessToken = cookieStore.get(ADMIN_ACCESS_TOKEN_KEY)?.value;

  if (!adminAccessToken) {
    return NextResponse.json({ isSuccess: false, errors: ["Authentication required. Please log in as an administrator."] }, { status: 401 });
  }

  const adminPayload = decodeJwtPayload(adminAccessToken);
  if (!adminPayload || !adminPayload.sub) {
    return NextResponse.json({ isSuccess: false, errors: ["Invalid admin token."] }, { status: 401 });
  }

  // Verify against local DB instead of just checking JWT role claim
  const adminUser = await databaseService.getUserByExternalId(adminPayload.sub, { roles: true });
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


  // 2. Get new user data from request body
  let newUserRegistrationData;
  try {
    newUserRegistrationData = await request.json();
  } catch (e) {
    return NextResponse.json({ isSuccess: false, errors: ["Invalid request format for new user."] }, { status: 400 });
  }

  const { firstName, lastName, phoneNumber, email, password } = newUserRegistrationData;

  if (!firstName || !lastName || !phoneNumber || !email || !password) {
    return NextResponse.json({ isSuccess: false, errors: ["Missing required fields for user registration (firstName, lastName, phoneNumber, email, password)."] }, { status: 400 });
  }

  // 3. Call external identity server to register the user
  let externalRegisterResponse: Response;
  try {
    externalRegisterResponse = await fetch(`${AUTH_API_BASE_URL}/api/Auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminAccessToken}`
      },
      body: JSON.stringify({ firstName, lastName, phoneNumber, email, password }),
    });
  } catch (networkError: any) {
    console.error("Network error calling external registration service:", networkError.message);
    return NextResponse.json({ isSuccess: false, errors: ["Failed to connect to user registration service."] }, { status: 503 });
  }

  const externalResponseText = await externalRegisterResponse.text();
  
  if (externalRegisterResponse.ok && !externalResponseText) {
      // Success, but no content. We need to log the user in to get their ID.
  } else if (!externalRegisterResponse.ok) {
    let errorMessages = [`User registration failed on the identity server. Status: ${externalRegisterResponse.status}`];
    if (externalResponseText) {
        try {
            const errorData = JSON.parse(externalResponseText);
            errorMessages = errorData?.errors || [errorData.message] || errorMessages;
        } catch (e) {
            errorMessages = [externalResponseText.substring(0, 200)];
        }
    }
    errorMessages = errorMessages.map(msg =>
      msg.includes("Password must be at least 8 characters")
          ? "Failed to Register, Password does not meet security requirements."
          : msg
  );
    return NextResponse.json({ isSuccess: false, errors: errorMessages }, { status: externalRegisterResponse.status });
  }
  
  let loginResponse: Response;
  try {
      loginResponse = await fetch(`${AUTH_API_BASE_URL}/api/Auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber, password }),
      });
  } catch (networkError: any) {
      console.error("Network error during post-registration login:", networkError.message);
      return NextResponse.json({ isSuccess: false, errors: ["Registered user, but failed to fetch their details from the identity service."] }, { status: 503 });
  }

  if (!loginResponse.ok) {
      return NextResponse.json({ isSuccess: false, errors: ["Registered user, but failed to log in to retrieve their details."] }, { status: 500 });
  }
  
  const loginData = await loginResponse.json();
  const newUserAccessToken = loginData.accessToken;

  if (!newUserAccessToken) {
    return NextResponse.json({ isSuccess: false, errors: ["Identity server did not return an access token for the new user after registration."] }, { status: 500 });
  }

  const newUserPayload = decodeJwtPayload(newUserAccessToken);
  if (!newUserPayload || !newUserPayload.sub) {
    return NextResponse.json({ isSuccess: false, errors: ["Failed to decode new user's token or extract user ID (sub)."] }, { status: 500 });
  }
  const newUserId = newUserPayload.sub;
  
  try {
    const userCreateInput: Prisma.UserCreateInput = {
      userId: newUserId,
      email: email,
      name: `${firstName} ${lastName}`.trim(),
      firstName: firstName,
      lastName: lastName,
      phoneNumber: phoneNumber,
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
    
    return NextResponse.json({ isSuccess: true, message: "User registered successfully.", userId: localUser.userId });

  } catch (dbError: any) {
    console.error("Error creating user in local database:", dbError);
    if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === 'P2002') {
         return NextResponse.json({ isSuccess: false, errors: [`User registered on identity server, but failed to create local record: A user with this User ID or Email already exists locally. (User ID: ${newUserId})`] }, { status: 409 });
    }
    return NextResponse.json({ isSuccess: false, errors: ["User registered on identity server, but failed to create local record.", dbError.message] }, { status: 500 });
  }
}
