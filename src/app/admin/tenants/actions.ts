
"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma } from '@prisma/client';
import { addMonths, isAfter } from 'date-fns'; // Import date-fns functions

export async function createTenantAction(
  data: Prisma.TenantCreateInput, 
  assignedSpaceId: string | null | undefined
) {
  try {
    const newTenant = await databaseService.createTenant(data);

    if (assignedSpaceId) {
      await databaseService.updateSpace(assignedSpaceId, {
        isOccupied: true,
        tenant: { connect: { id: newTenant.id } },
      });
      await databaseService.updateTenant(newTenant.id, {
        rentedSpace: { connect: { id: assignedSpaceId } }
      });
    }

    revalidatePath('/admin/tenants');
    revalidatePath('/admin/spaces'); 
    return { success: true, tenant: newTenant };
  } catch (error: any) {
    console.error("Error creating tenant:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      let fieldName = "email or another unique field";
      if (error.meta && typeof error.meta.target === 'string') {
        fieldName = error.meta.target;
      } else if (Array.isArray(error.meta?.target)) {
        fieldName = error.meta.target.join(', ');
      }
      return { success: false, error: `Failed to create tenant. A tenant with the same ${fieldName} might already exist.` };
    }
    return { success: false, error: error.message || "Failed to create tenant." };
  }
}

export async function updateTenantAction(
  tenantId: string,
  data: Prisma.TenantUpdateInput, 
  newAssignedSpaceId: string | null | undefined,
  oldAssignedSpaceId: string | null | undefined
) {
  try {
    const updatedTenant = await databaseService.updateTenant(tenantId, data);

    if (oldAssignedSpaceId !== newAssignedSpaceId) {
      if (oldAssignedSpaceId) {
        await databaseService.updateSpace(oldAssignedSpaceId, {
          isOccupied: false,
          tenant: { disconnect: true }, 
        });
      }
      if (newAssignedSpaceId) {
        await databaseService.updateSpace(newAssignedSpaceId, {
          isOccupied: true,
          tenant: { connect: { id: tenantId } }, 
        });
      }
    }
    
    if (newAssignedSpaceId) {
        await databaseService.updateTenant(tenantId, { 
            rentedSpace: { connect: { id: newAssignedSpaceId } } 
        });
    } else if (oldAssignedSpaceId && !newAssignedSpaceId) { 
        await databaseService.updateTenant(tenantId, { 
            rentedSpace: { disconnect: true } 
        });
    }

    revalidatePath('/admin/tenants');
    revalidatePath('/admin/spaces'); 
    return { success: true, tenant: updatedTenant };
  } catch (error: any) {
    console.error("Error updating tenant:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        let fieldName = "email or another unique field";
        if (error.meta && typeof error.meta.target === 'string') {
            fieldName = error.meta.target;
        } else if (Array.isArray(error.meta?.target)) {
            fieldName = error.meta.target.join(', ');
        }
        return { success: false, error: `Failed to update tenant. A tenant with the same ${fieldName} might already exist.` };
      }
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
      include: {
        agreements: true, // Fetch all agreements
        rentedSpace: true
      }
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

    const spaceIdToVacate = tenant.rentedSpaceId;

    if (spaceIdToVacate) {
      await databaseService.updateSpace(spaceIdToVacate, {
        isOccupied: false,
        tenant: { disconnect: true }, 
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

