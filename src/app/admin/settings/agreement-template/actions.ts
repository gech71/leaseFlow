
"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { getUserAndPermissions } from '@/lib/actions/server-helpers';
import { AgreementTemplate, Prisma } from '@prisma/client';

export async function getAllAgreementTemplatesAction(): Promise<{
  success: boolean;
  templates?: AgreementTemplate[];
  error?: string;
}> {
  try {
    const templates = await databaseService.getAllAgreementTemplates({ orderBy: { name: 'asc' }});
    return { success: true, templates };
  } catch (error: any) {
    console.error("Error fetching agreement templates:", error);
    return { success: false, error: "Failed to fetch templates from the database." };
  }
}

export async function getAgreementTemplateByIdAction(id: string): Promise<{
  success: boolean;
  template?: AgreementTemplate | null;
  error?: string;
}> {
    try {
        const template = await databaseService.getAgreementTemplateById(id);
        return { success: true, template };
    } catch (error: any) {
        console.error(`Error fetching agreement template with id ${id}:`, error);
        return { success: false, error: `Failed to fetch template with id ${id}.`};
    }
}

export async function upsertAgreementTemplateAction(
    data: { id?: string; name: string; content: string }
): Promise<{ success: boolean; template?: AgreementTemplate; error?: string }> {
    try {
        const { isSuperAdmin } = await getUserAndPermissions();
        if (!isSuperAdmin) {
            return { success: false, error: "Permission denied. Only Super Admins can manage agreement templates." };
        }

        if (data.id) { // Update
            const updatedTemplate = await databaseService.updateAgreementTemplate(data.id, {
                name: data.name,
                content: data.content,
            });
            revalidatePath('/admin/agreements/generate');
            revalidatePath('/admin/settings/agreement-template');
            return { success: true, template: updatedTemplate };
        } else { // Create
            const newTemplate = await databaseService.createAgreementTemplate({
                name: data.name,
                content: data.content,
            });
            revalidatePath('/admin/agreements/generate');
            revalidatePath('/admin/settings/agreement-template');
            return { success: true, template: newTemplate };
        }
    } catch (error: any) {
        console.error("Error upserting agreement template:", error);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return { success: false, error: `A template with the name "${data.name}" already exists.` };
        }
        return { success: false, error: "Failed to save the template." };
    }
}

export async function deleteAgreementTemplateAction(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { isSuperAdmin } = await getUserAndPermissions();
        if (!isSuperAdmin) {
            return { success: false, error: "Permission denied. Only Super Admins can delete agreement templates." };
        }
        await databaseService.deleteAgreementTemplate(id);
        revalidatePath('/admin/agreements/generate');
        revalidatePath('/admin/settings/agreement-template');
        return { success: true };
    } catch (error: any) {
        console.error(`Error deleting agreement template with id ${id}:`, error);
        return { success: false, error: `Failed to delete template with id ${id}.` };
    }
}
