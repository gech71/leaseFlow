
"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma } from '@prisma/client';
import { addMonths, isAfter } from 'date-fns'; // Import date-fns functions

export async function createTenantAction(
  data: Prisma.TenantCreateInput
) {
  try {
    const newTenant = await databaseService.createTenant(data);
    revalidatePath('/admin/tenants');
    return { success: true, tenant: newTenant };
  } catch (error: any) {
    console.error("Error creating tenant:", error);
    return { success: false, error: error.message || "Failed to create tenant." };
  }
}

export async function updateTenantAction(
  tenantId: string,
  data: Prisma.TenantUpdateInput
) {
  try {
    const updatedTenant = await databaseService.updateTenant(tenantId, data);
    revalidatePath('/admin/tenants');
    return { success: true, tenant: updatedTenant };
  } catch (error: any) {
    console.error("Error updating tenant:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { 
        return { success: false, error: "Failed to update tenant. Record not found." };
      }
    }
    return { success: false, error: error.message || "Failed to update tenant." };
  }
}

export async function deleteTenantAction(tenantId: string) {
  try {
    const tenant = await databaseService.getTenantById(tenantId, {
      agreements: true,
    });

    if (!tenant) {
      return { success: false, error: "Tenant not found." };
    }

    // Check for active agreements in application code
    if (tenant.agreements && tenant.agreements.length > 0) {
      const activeAgreements = tenant.agreements.filter(agreement => {
        const agreementEndDate = addMonths(agreement.startDate, agreement.paymentTermMonths);
        return isAfter(agreementEndDate, new Date());
      });
      if (activeAgreements.length > 0) {
        return { success: false, error: "Cannot delete tenant with active or future agreements. Please resolve or terminate these agreements first." };
      }
    }
    
    // Find any space that this tenant occupies
    const spacesOccupiedByTenant = await databaseService.getAllSpaces({
        where: { tenantId: tenantId }
    });

    // Vacate all spaces linked to this tenant
    for (const space of spacesOccupiedByTenant) {
        await databaseService.updateSpace(space.id, {
            isOccupied: false,
            tenant: { disconnect: true }
        });
    }
    
    await databaseService.deleteTenant(tenantId);

    revalidatePath('/admin/tenants');
    revalidatePath('/admin/spaces'); 
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting tenant:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { 
        return { success: false, error: "Failed to delete tenant. Record not found." };
      }
      if (error.code === 'P2003') {
        return { success: false, error: "Cannot delete this tenant as they are referenced by other records (e.g., historical bills or other non-active agreements not caught by the check). Please ensure all dependencies are cleared or consider archiving." };
      }
    }
    return { success: false, error: error.message || "Failed to delete tenant." };
  }
}
