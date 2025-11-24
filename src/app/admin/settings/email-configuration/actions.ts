
"use server";

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getUserAndPermissions } from '@/lib/actions/server-helpers';

export async function getSmtpConfigurationAction(): Promise<{
  success: boolean;
  smtpUser: string;
  isSmtpPassSet: boolean;
  error?: string;
}> {
  try {
    const smtpUser = process.env.SMTP_USER || '';
    const smtpPass = process.env.SMTP_PASS || '';
    const isSmtpPassSet = !!smtpPass;
    
    return { success: true, smtpUser, isSmtpPassSet };
  } catch (error: any) {
    console.error("Error fetching SMTP configuration:", error);
    return { success: false, smtpUser: '', isSmtpPassSet: false, error: "Failed to fetch configuration." };
  }
}

export async function updateSmtpPasswordAction(newPassword: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { isSuperAdmin } = await getUserAndPermissions();
    if (!isSuperAdmin) {
      return { success: false, error: "Permission denied." };
    }
    
    if (!newPassword) {
      return { success: false, error: "Password cannot be empty." };
    }

    // This action will now be a placeholder or could be used to validate
    // that the environment variable is set on the server, but it can't
    // directly modify the .env file for security reasons.
    
    console.log("A request was made to update the SMTP password. This must be done manually in the .env file.");

    revalidatePath('/admin/settings/email-configuration');
    
    return { success: true };
  } catch (error: any) {
    console.error("Error updating SMTP password:", error);
    let errorMessage = "Failed to update password.";
    return { success: false, error: errorMessage };
  }
}
