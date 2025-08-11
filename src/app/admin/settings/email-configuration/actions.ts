
"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { getUserAndPermissions } from '@/lib/actions/server-helpers';
import { encryptionService } from '@/lib/services/encryptionService';

export async function getSmtpConfigurationAction(): Promise<{
  success: boolean;
  smtpUser: string;
  isSmtpPassSet: boolean;
  error?: string;
}> {
  try {
    const smtpUser = process.env.SMTP_USER || '';
    const encryptedSmtpPass = await databaseService.getSecret('SMTP_PASS');
    const isSmtpPassSet = !!encryptedSmtpPass;
    
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

    const encryptedPassword = encryptionService.encrypt(newPassword);
    await databaseService.setSecret('SMTP_PASS', encryptedPassword);
    
    revalidatePath('/admin/settings/email-configuration');
    
    return { success: true };
  } catch (error: any) {
    console.error("Error updating SMTP password:", error);
    let errorMessage = "Failed to update password.";
    if (error.message.includes("Encryption key is not set")) {
        errorMessage = "Cannot update password: The server's ENCRYPTION_KEY is not set."
    }
    return { success: false, error: errorMessage };
  }
}
