"use server";

import { auth, signOut } from "@/auth";
import { databaseService } from "@/lib/services/databaseService";
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const changePasswordSchema = z.object({
  newPassword: z.string().min(6, "New password must be at least 6 characters."),
});

export async function forceChangePasswordAction(values: z.infer<typeof changePasswordSchema>): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      // This case might happen if they navigate here directly without the temp password flow
      return { success: false, error: "Authentication session not found. Please log in again." };
    }

    const validatedData = changePasswordSchema.safeParse(values);
    if (!validatedData.success) {
        return { success: false, error: "Invalid data provided."};
    }
    const { newPassword } = validatedData.data;

    const user = await databaseService.getUserById(session.user.id);
    if (!user) {
      return { success: false, error: "User not found." };
    }

    // This action is only for the initial password change. We don't check the current password.
    // We check the flag from the session which came from the temp password login flow.
    if (!session.user.forceChangePass) {
        return { success: false, error: "This account does not require a password change." };
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await databaseService.updateUser(user.id, {
      password: hashedNewPassword,
      tempPassword: null, // Clear the temporary password
    });

    // Sign the user out after a successful password change.
    await signOut({ redirect: false });

    return { success: true };
  } catch (error) {
    console.error("Force change password server action error:", error);
    return { success: false, error: "An unexpected server error occurred." };
  }
}
