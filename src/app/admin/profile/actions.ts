
"use server";

import { databaseService } from "@/lib/services/databaseService";
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { lucia } from '@/lib/auth';
import { cookies } from 'next/headers';
import { validateRequest } from '@/lib/auth';

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string(),
});

export async function changePassword(values: z.infer<typeof changePasswordSchema>): Promise<{ success: boolean; error?: string }> {
  try {
    const { user: sessionUser } = await validateRequest();
    if (!sessionUser) {
      return { success: false, error: "Authentication required." };
    }

    const validatedData = changePasswordSchema.safeParse(values);
    if (!validatedData.success) {
        return { success: false, error: "Invalid data provided."};
    }
    const { currentPassword, newPassword } = validatedData.data;

    const user = await databaseService.getUserById(sessionUser.id);
    if (!user || !user.password) {
      return { success: false, error: "User not found or password not set." };
    }

    const passwordsMatch = await bcrypt.compare(currentPassword, user.password);
    if (!passwordsMatch) {
      return { success: false, error: "The current password you entered is incorrect." };
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await databaseService.updateUser(user.id, {
      password: hashedNewPassword,
      tempPassword: null, // Clear any temporary password
    });

    // Invalidate the user's session, forcing them to log in again.
    await lucia.invalidateUserSessions(sessionUser.id);
    
    // Create and set a blank session cookie to overwrite the existing one
    const sessionCookie = lucia.createBlankSessionCookie();
    cookies().set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

    return { success: true };
  } catch (error) {
    console.error("Change password server action error:", error);
    return { success: false, error: "An unexpected server error occurred." };
  }
}
