
'use server';

import { cookies } from 'next/headers';
import { signIn } from '@/lib/auth';
import { databaseService } from '@/lib/services/databaseService';

export async function setPortalSessionAction(token: string, phone: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await databaseService.findUserByPhoneNumber(phone);
    if (!user) {
      return { success: false, error: "User not found." };
    }
    
    // For the mini-app flow, we are not checking passwords.
    // The trust is based on the validated NIB token.
    await signIn("credentials", {
        redirect: false,
        phoneNumber: user.phoneNumber,
        password: `mini-app-login-${token}`, // Use a dummy password
        isFromMiniApp: true,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to set portal session:", error);
    if (error instanceof Error && (error as any).type === 'CredentialsSignin') {
      return { success: false, error: 'Mini-app login failed.' };
    }
    return { success: false, error: 'An unexpected error occurred during session creation.' };
  }
}
