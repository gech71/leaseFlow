
"use server";

import { databaseService } from "@/lib/services/databaseService";
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { verifySession, deleteSession } from '@/lib/auth/jwt';

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string(),
});

export async function changePassword(values: z.infer<typeof changePasswordSchema>): Promise<{ success: boolean; error?: string }> {
  const sessionUser = await verifySession();
  if (!sessionUser) {
    throw new Error("Authentication required.");
  }

  const validatedData = changePasswordSchema.safeParse(values);
  if (!validatedData.success) {
    throw new Error("Invalid data provided.");
  }
  const { currentPassword, newPassword } = validatedData.data;

  // If the user is changing their temporary password, we don't need to verify the old one.
  // The 'currentPassword' in this case is the temporary password itself.
  const user = await databaseService.getUserById(sessionUser.userId);
  if (!user) {
    throw new Error("User not found.");
  }

  if (user.tempPassword) {
      if (currentPassword !== user.tempPassword) {
          return { success: false, error: "The temporary password you entered is incorrect." };
      }
  } else if (user.password) {
      const passwordsMatch = await bcrypt.compare(currentPassword, user.password);
      if (!passwordsMatch) {
        return { success: false, error: "The current password you entered is incorrect." };
      }
  } else {
      // Should not happen if a user is logged in
      return { success: false, error: "No valid password found to verify against." };
  }


  const hashedNewPassword = await bcrypt.hash(newPassword, 10);
  await databaseService.updateUser(user.id, {
    password: hashedNewPassword,
    tempPassword: null, // Clear any temporary password after successful change
  });

  // Invalidate the user's session to force a re-login with the new password
  await deleteSession();

  return { success: true };
}
