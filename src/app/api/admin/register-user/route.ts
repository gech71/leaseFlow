
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { databaseService } from '@/lib/services/databaseService';
import type { Prisma } from '@prisma/client';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;
const ACCESS_TOKEN_KEY = 'leaseflow_access_token'; // For the admin making the request

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

  // 1. Verify requester is SUPER_ADMIN
  const cookieStore = cookies();
  const adminAccessToken = cookieStore.get(ACCESS_TOKEN_KEY)?.value;

  if (!adminAccessToken) {
    return NextResponse.json({ isSuccess: false, errors: ["Authentication required."] }, { status: 401 });
  }

  const adminPayload = decodeJwtPayload(adminAccessToken);
  // Assuming the role claim in your JWT is "Admin" for super admins
  if (!adminPayload || adminPayload.role !== "Admin") { 
    return NextResponse.json({ isSuccess: false, errors: ["Unauthorized: Only Super Admins can register users."] }, { status: 403 });
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
    externalRegisterResponse = await fetch(`${AUTH_API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, phoneNumber, email, password }),
    });
  } catch (networkError: any) {
    console.error("Network error calling external registration service:", networkError.message);
    return NextResponse.json({ isSuccess: false, errors: ["Failed to connect to user registration service."] }, { status: 503 });
  }

  let externalResponseText;
  try {
    externalResponseText = await externalRegisterResponse.text();
  } catch (textError: any) {
    return NextResponse.json({ isSuccess: false, errors: [`Registration service responded with an unreadable body (Status: ${externalRegisterResponse.status}).`] }, { status: externalRegisterResponse.status || 500 });
  }
  
  let externalResponseData;
  if (externalResponseText) {
    try {
      externalResponseData = JSON.parse(externalResponseText);
    } catch (jsonError: any) {
      if (!externalRegisterResponse.ok) {
        return NextResponse.json({ isSuccess: false, errors: [`Registration service responded with status: ${externalRegisterResponse.status} and an invalid JSON: ${externalResponseText.substring(0,100)}...`] }, { status: externalRegisterResponse.status });
      }
      return NextResponse.json({ isSuccess: false, errors: ["Received an invalid JSON response from registration service."] }, { status: 500 });
    }
  } else if (!externalRegisterResponse.ok) {
      return NextResponse.json({ isSuccess: false, errors: [`Registration service responded with status: ${externalRegisterResponse.status} and an empty response.`] }, { status: externalRegisterResponse.status });
  }


  if (!externalRegisterResponse.ok || !externalResponseData?.isSuccess) {
    const errorMessages = externalResponseData?.errors && Array.isArray(externalResponseData.errors) && externalResponseData.errors.length > 0
      ? externalResponseData.errors
      : ["User registration failed on the identity server."];
    return NextResponse.json({ isSuccess: false, errors: errorMessages }, { status: externalRegisterResponse.status || 400 });
  }

  // 4. If external registration is successful, get new user's ID and details from their token
  const newUserAccessToken = externalResponseData.accessToken;
  if (!newUserAccessToken) {
    return NextResponse.json({ isSuccess: false, errors: ["Identity server did not return an access token for the new user."] }, { status: 500 });
  }

  const newUserPayload = decodeJwtPayload(newUserAccessToken);
  if (!newUserPayload || !newUserPayload.sub) {
    return NextResponse.json({ isSuccess: false, errors: ["Failed to decode new user's token or extract user ID (sub)."] }, { status: 500 });
  }

  const newUserId = newUserPayload.sub;
  const newUserEmail = newUserPayload.email || email; // Fallback to input email if not in token
  const newUserFirstName = newUserPayload.firstName || firstName;
  const newUserLastName = newUserPayload.lastName || lastName;
  // The claim name for phone number is "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/mobilephone"
  const newUserPhoneNumber = newUserPayload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/mobilephone"] || phoneNumber;
  
  // 5. Store new user in local Prisma database
  try {
    // Fetch the default role (e.g., "SUPPORT_STAFF")
    // For simplicity, let's assume "SUPPORT_STAFF" role is seeded and its name is known.
    // In a real app, you might fetch by a known ID or provide a selection UI.
    const defaultRole = await databaseService.getAllRoles({ where: { name: "SUPPORT_STAFF" } });
    if (!defaultRole || defaultRole.length === 0) {
        // Fallback to a generic role if SUPPORT_STAFF is not found or create a basic one
        // This part needs robust handling in a production app.
        console.warn("SUPPORT_STAFF role not found for new user. Assigning no role or consider creating one.");
         // Create a user without a role or with a dynamically created basic role
    }
    
    const userCreateInput: Prisma.UserCreateInput = {
      userId: newUserId,
      email: newUserEmail,
      name: `${newUserFirstName} ${newUserLastName}`.trim(),
      firstName: newUserFirstName,
      lastName: newUserLastName,
      phoneNumber: newUserPhoneNumber,
      roles: defaultRole && defaultRole.length > 0 ? { connect: { id: defaultRole[0].id } } : undefined,
    };

    const localUser = await databaseService.createUser(userCreateInput);
    
    // Note: The new user's tokens from identity server are NOT set as cookies here.
    // The new user would have to log in themselves.
    return NextResponse.json({ isSuccess: true, message: "User registered successfully and created locally.", userId: localUser.userId });

  } catch (dbError: any) {
    console.error("Error creating user in local database:", dbError);
    // Potentially try to "rollback" or notify about inconsistency if external registration succeeded but local failed.
    // For now, return a specific error.
    if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === 'P2002') {
         return NextResponse.json({ isSuccess: false, errors: [`User registered on identity server, but failed to create local record: A user with this User ID or Email already exists locally. (User ID: ${newUserId})`] }, { status: 409 });
    }
    return NextResponse.json({ isSuccess: false, errors: ["User registered on identity server, but failed to create local record.", dbError.message] }, { status: 500 });
  }
}
