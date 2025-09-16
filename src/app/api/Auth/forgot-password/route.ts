import { NextResponse, type NextRequest } from "next/server";
import { getUserAndPermissions } from "@/lib/actions/server-helpers";
import { databaseService } from "@/lib/services/databaseService";

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;

export async function POST(request: NextRequest) {
  if (!AUTH_API_BASE_URL) {
    console.error("Auth API base URL is not configured.");
    return NextResponse.json(
      {
        isSuccess: false,
        errors: ["Authentication service is not configured."],
      },
      { status: 500 },
    );
  }

  let requestBody;
  try {
    requestBody = await request.json();
  } catch (e) {
    return NextResponse.json(
      { isSuccess: false, errors: ["Invalid request format."] },
      { status: 400 },
    );
  }

  const { phoneNumber } = requestBody;
  if (!phoneNumber) {
    return NextResponse.json(
      { isSuccess: false, errors: ["Phone number is required."] },
      { status: 400 },
    );
  }

  try {
    const { currentUser, isSuperAdmin } = await getUserAndPermissions();

    const targetUser = await databaseService.findUserByPhoneNumber(phoneNumber);

    if (!targetUser) {
      return NextResponse.json(
        {
          isSuccess: false,
          errors: ["User with this phone number not found."],
        },
        { status: 404 },
      );
    }

    // Apply security rule: Super Admin can reset anyone.
    // Other admins can only reset users they created.
    if (!isSuperAdmin && targetUser.createdById !== currentUser.id) {
      return NextResponse.json(
        {
          isSuccess: false,
          errors: ["You do not have permission to reset this user's password."],
        },
        { status: 403 },
      );
    }

    const externalResponse = await fetch(
      `${AUTH_API_BASE_URL}/api/Auth/forgot-password`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
      },
    );

    const responseText = await externalResponse.text();

    if (!externalResponse.ok) {
      let errorMessages = ["Failed to initiate password reset."];
      if (responseText) {
        try {
          const errorData = JSON.parse(responseText);
          errorMessages =
            errorData?.errors ||
            (errorData.message ? [errorData.message] : errorMessages);
        } catch (e) {
          errorMessages = [responseText.substring(0, 150)];
        }
      }
      return NextResponse.json(
        { isSuccess: false, errors: errorMessages },
        { status: externalResponse.status },
      );
    }

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      console.error(
        "Forgot password API call successful, but failed to parse JSON response from identity server.",
        responseText,
      );
      return NextResponse.json(
        {
          isSuccess: false,
          errors: [
            "Received an invalid response from the authentication service.",
          ],
        },
        { status: 500 },
      );
    }

      const message = responseData.message;
      
    if (typeof message === "string" && message.trim()) {
      return NextResponse.json({ isSuccess: true, token: message.trim() });
    }
    return NextResponse.json(
      {
        isSuccess: false,
        errors: [
          "Forgot password request was successful, but no token was returned.",
        ],
      },
      { status: 500 },
    );
  } catch (error: any) {
    console.error("Forgot password API call error:", error);
    // Handle cases where getUserAndPermissions throws an error (e.g., no session)
    if (error.message.includes("Authentication required")) {
      return NextResponse.json(
        {
          isSuccess: false,
          errors: ["You must be logged in to perform this action."],
        },
        { status: 401 },
      );
    }
    return NextResponse.json(
      {
        isSuccess: false,
        errors: ["Could not connect to the authentication service."],
      },
      { status: 503 },
    );
  }
}
