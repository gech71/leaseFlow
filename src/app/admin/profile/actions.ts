"use server";

import { auth, signOut } from "@/auth";
import { databaseService } from "@/lib/services/databaseService";
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string(),
});

export async function changePassword(values: z.infer<typeof changePasswordSchema>): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Authentication required." };
    }

    const validatedData = changePasswordSchema.safeParse(values);
    if (!validatedData.success) {
        return { success: false, error: "Invalid data provided."};
    }
    const { currentPassword, newPassword } = validatedData.data;

    const user = await databaseService.getUserById(session.user.id);
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

    // After a successful password change, we should log the user out
    // to ensure all session data is refreshed on next login.
    await signOut({ redirect: false });

    return { success: true };
  } catch (error) {
    console.error("Change password server action error:", error);
    return { success: false, error: "An unexpected server error occurred." };
  }
}
