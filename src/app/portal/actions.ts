
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
    
    await signIn("credentials", {
        redirect: false,
        phoneNumber: user.phoneNumber,
        isFromMiniApp: true, // Special flag to bypass password check in authorize
        miniAppToken: token, // Pass the token for potential logging/auditing
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
