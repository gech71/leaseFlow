"use server";

import { auth } from "@/lib/auth";
import { databaseService } from "@/lib/services/databaseService";
import bcrypt from "bcrypt";
import { z } from 'zod';

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string(),
});

type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export async function changePasswordAction(values: ChangePasswordValues) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Authentication required." };
    }

    const user = await databaseService.getUserById(session.user.id);
    if (!user || !user.password) {
      return { success: false, error: "User not found or password not set." };
    }

    const passwordsMatch = await bcrypt.compare(values.currentPassword, user.password);
    if (!passwordsMatch) {
      return { success: false, error: "Incorrect current password." };
    }

    const hashedNewPassword = await bcrypt.hash(values.newPassword, 10);
    
    await databaseService.updateUser(user.id, {
      password: hashedNewPassword,
      tempPassword: null,
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error changing password:", error);
    return { success: false, error: "An unexpected error occurred." };
  }
}
