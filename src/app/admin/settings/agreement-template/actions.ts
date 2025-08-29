
"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { getUserAndPermissions } from '@/lib/actions/server-helpers';

const TEMPLATE_KEY = 'agreementTemplate';

export async function getAgreementTemplateAction(): Promise<{
  success: boolean;
  template?: string | null;
  error?: string;
}> {
  try {
    const { permissions, isSuperAdmin } = await getUserAndPermissions();
    // For now, let's assume any admin can view the template setting
    
    const setting = await databaseService.getSetting(TEMPLATE_KEY);
    return { success: true, template: setting?.value };
  } catch (error: any) {
    console.error("Error fetching agreement template:", error);
    return { success: false, template: null, error: "Failed to fetch template." };
  }
}

export async function saveAgreementTemplateAction(template: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { isSuperAdmin } = await getUserAndPermissions();
    if (!isSuperAdmin) {
      return { success: false, error: "Permission denied. Only Super Admins can save the agreement template." };
    }
    
    if (template.length < 50) {
        return { success: false, error: "Template seems too short. Please provide a more detailed agreement." };
    }

    await databaseService.setSetting(TEMPLATE_KEY, template);
    
    // Revalidate the path of the agreement generation page since it uses this data
    revalidatePath('/admin/agreements/generate');
    
    return { success: true };
  } catch (error: any) {
    console.error("Error saving agreement template:", error);
    return { success: false, error: "Failed to save the template to the database." };
  }
}
