"use server";

import { databaseService } from "@/lib/services/databaseService";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  verifySession,
  getSessionCookieNames,
  ACCESS_TOKEN_COOKIE_NAME,
} from "@/lib/auth/jwt";
import { cookies } from "next/headers";
import { GENERIC_AUTH_ERROR } from "@/lib/security/messages";
import { isCommonPassword } from "@/lib/security/common-passwords";

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string(),
});

export async function changePassword(
  values: z.infer<typeof changePasswordSchema>,
): Promise<{ success: boolean; error?: string }> {
  const token = cookies().get(ACCESS_TOKEN_COOKIE_NAME)?.value;
  const sessionUser = await verifySession(token);
  if (!sessionUser) {
    throw new Error(GENERIC_AUTH_ERROR);
  }

  const validatedData = changePasswordSchema.safeParse(values);
  if (!validatedData.success) {
    throw new Error("Invalid data provided.");
  }
  const { currentPassword, newPassword } = validatedData.data;

  const user = await databaseService.getUserById(sessionUser.userId);
  if (!user || !user.password) {
    throw new Error(GENERIC_AUTH_ERROR);
  }

  const passwordsMatch = await bcrypt.compare(currentPassword, user.password);
  if (!passwordsMatch) {
    throw new Error(GENERIC_AUTH_ERROR);
  }

  // Reject very common passwords (case-insensitive + small fuzzy check)
  if (isCommonPassword(newPassword, { fuzzy: true, maxDistance: 1 })) {
    return {
      success: false,
      error:
        "The selected password is commonly used and does not meet our security standards. Please choose a more secure option.",
    };
  }

  const hashedNewPassword = await bcrypt.hash(newPassword, 10);
  await databaseService.updateUser(user.id, {
    password: hashedNewPassword,
    tempPassword: null, // Clear any temporary password
  });

  // Invalidate the user's session by deleting the cookie
  const cookieNames = getSessionCookieNames();
  cookieNames.forEach((name) => {
    cookies().set(name, "", { expires: new Date(0), path: "/" });
  });

  return { success: true };
}
