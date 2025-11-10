
"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { getUserAndPermissions } from '@/lib/actions/server-helpers';
import { AgreementTemplate, Prisma } from '@prisma/client';
import { redirect } from 'next/navigation';

export async function getAllAgreementTemplatesAction(): Promise<{
  success: boolean;
  templates?: AgreementTemplate[];
  error?: string;
}> {
  try {
    const { currentUser, isSuperAdmin } = await getUserAndPermissions();
    const where: Prisma.AgreementTemplateWhereInput = !isSuperAdmin ? { createdById: currentUser.id } : {};
    
    const templates = await databaseService.getAllAgreementTemplates({ 
      where,
      orderBy: { name: 'asc' }
    });
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
        const { currentUser, isSuperAdmin, permissions } = await getUserAndPermissions();
        if (!isSuperAdmin && !permissions.has('settings:agreement_templates:manage')) {
            return { success: false, error: "Permission denied. You do not have permission to manage agreement templates." };
        }

        const createOrUpdateData = {
          name: data.name,
          content: data.content,
          createdBy: data.id ? undefined : { connect: { id: currentUser.id } } // Only connect on create
        };

        if (data.id) { // Update
            await databaseService.updateAgreementTemplate(data.id, {
                name: data.name,
                content: data.content,
            });
            revalidatePath('/admin/settings/agreement-template');
        } else { // Create
            await databaseService.createAgreementTemplate({
                name: data.name,
                content: data.content,
                createdBy: { connect: { id: currentUser.id } }
            });
            revalidatePath('/admin/settings/agreement-template');
        }
    } catch (error: any) {
        console.error("Error upserting agreement template:", error);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return { success: false, error: `A template with the name "${data.name}" already exists.` };
        }
        return { success: false, error: "Failed to save the template." };
    }
    
    // Redirect after successful operation
    redirect('/admin/settings/agreement-template');
}

export async function deleteAgreementTemplateAction(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { isSuperAdmin, permissions } = await getUserAndPermissions();
        if (!isSuperAdmin && !permissions.has('settings:agreement_templates:manage')) {
            return { success: false, error: "Permission denied. You do not have permission to delete agreement templates." };
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
