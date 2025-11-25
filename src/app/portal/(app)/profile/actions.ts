"use server";

import { databaseService } from "@/lib/services/databaseService";
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { verifySession, getSessionCookieNames, ACCESS_TOKEN_COOKIE_NAME } from '@/lib/auth/jwt';
import { cookies } from "next/headers";

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string(),
});

export async function changePassword(values: z.infer<typeof changePasswordSchema>): Promise<{ success: boolean; error?: string }> {
  const token = cookies().get(ACCESS_TOKEN_COOKIE_NAME)?.value;
  const sessionUser = await verifySession(token);
  if (!sessionUser) {
    throw new Error("Authentication required.");
  }

  const validatedData = changePasswordSchema.safeParse(values);
  if (!validatedData.success) {
    throw new Error("Invalid data provided.");
  }
  const { currentPassword, newPassword } = validatedData.data;

  const user = await databaseService.getUserById(sessionUser.userId);
  if (!user || !user.password) {
    throw new Error("User not found or password not set.");
  }

  const passwordsMatch = await bcrypt.compare(currentPassword, user.password);
  if (!passwordsMatch) {
    throw new Error("The current password you entered is incorrect.");
  }

  const hashedNewPassword = await bcrypt.hash(newPassword, 10);
  await databaseService.updateUser(user.id, {
    password: hashedNewPassword,
    tempPassword: null, // Clear any temporary password
  });

  // Invalidate the user's session by deleting the cookie
  const cookieNames = getSessionCookieNames();
  cookieNames.forEach(name => {
      cookies().set(name, '', { expires: new Date(0), path: '/' });
  });

  return { success: true };
}