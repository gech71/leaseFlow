
"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma } from '@prisma/client';

export async function createTenantAction(
  data: Prisma.TenantCreateInput, // This data comes from the form, excluding relational fields like rentedSpace
  assignedSpaceId: string | null | undefined
) {
  try {
    // Create the tenant with their basic details
    const newTenant = await databaseService.createTenant(data);

    if (assignedSpaceId) {
      // 1. Update the Space: Mark as occupied and link to the new tenant (sets Space.tenantId)
      await databaseService.updateSpace(assignedSpaceId, {
        isOccupied: true,
        tenant: { connect: { id: newTenant.id } },
      });
      // 2. Update the Tenant: Link the tenant to the assigned space (sets Tenant.rentedSpaceId via relation)
      await databaseService.updateTenant(newTenant.id, {
        rentedSpace: { connect: { id: assignedSpaceId } }
      });
    }

    revalidatePath('/admin/tenants');
    revalidatePath('/admin/spaces'); // Also revalidate spaces as occupancy might change
    return { success: true, tenant: newTenant };
  } catch (error: any) {
    console.error("Error creating tenant:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      // Attempt to find which field caused the unique constraint violation
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
  data: Prisma.TenantUpdateInput, // Tenant's scalar fields to update
  newAssignedSpaceId: string | null | undefined,
  oldAssignedSpaceId: string | null | undefined
) {
  try {
    // 1. Update tenant's scalar details first
    const updatedTenant = await databaseService.updateTenant(tenantId, data);

    // 2. Handle space assignment changes
    if (oldAssignedSpaceId !== newAssignedSpaceId) {
      // Vacate old space if it exists and is different from new one
      if (oldAssignedSpaceId) {
        await databaseService.updateSpace(oldAssignedSpaceId, {
          isOccupied: false,
          tenant: { disconnect: true }, // This should clear Space.tenantId
        });
      }
      // Occupy new space if it exists
      if (newAssignedSpaceId) {
        await databaseService.updateSpace(newAssignedSpaceId, {
          isOccupied: true,
          tenant: { connect: { id: tenantId } }, // This should set Space.tenantId
        });
      }
    }
    
    // 3. Update the tenant's own link to the space (Tenant.rentedSpace relation)
    // This ensures Tenant.rentedSpaceId is correctly set or cleared.
    if (newAssignedSpaceId) {
        await databaseService.updateTenant(tenantId, { 
            rentedSpace: { connect: { id: newAssignedSpaceId } } 
        });
    } else if (oldAssignedSpaceId && !newAssignedSpaceId) { // Only disconnect if there was an old space and no new one
        await databaseService.updateTenant(tenantId, { 
            rentedSpace: { disconnect: true } 
        });
    }


    revalidatePath('/admin/tenants');
    revalidatePath('/admin/spaces'); // Revalidate spaces as occupancy/tenant links change
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
      if (error.code === 'P2025') { // Record to update not found
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
        agreements: { 
          // Check for active agreements (end date is in the future or null)
          where: { 
            OR: [
              { endDate: { gte: new Date() } },
              { endDate: null } // Assuming null endDate means ongoing or indefinite
            ]
          } 
        },
        rentedSpace: true 
      } 
    });

    if (!tenant) {
      return { success: false, error: "Tenant not found." };
    }

    if (tenant.agreements && tenant.agreements.length > 0) {
      return { success: false, error: "Cannot delete tenant with active or future agreements. Please resolve or terminate these agreements first." };
    }

    const spaceIdToVacate = tenant.rentedSpaceId;

    // If tenant was linked to a space, update the space
    if (spaceIdToVacate) {
      await databaseService.updateSpace(spaceIdToVacate, {
        isOccupied: false,
        tenant: { disconnect: true }, // This should clear Space.tenantId
      });
      // Also ensure the tenant's link to the space is cleared before deleting the tenant.
      // This is more of a safeguard if onDelete: SetNull isn't perfectly configured or
      // if there are other constraints. Prisma usually handles this well if relations are set.
      // await databaseService.updateTenant(tenantId, {
      //   rentedSpace: { disconnect: true }
      // });
    }
    
    // Now delete the tenant
    await databaseService.deleteTenant(tenantId);

    revalidatePath('/admin/tenants');
    revalidatePath('/admin/spaces'); // Revalidate spaces if a space was vacated
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting tenant:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { // Record to delete not found
        return { success: false, error: "Failed to delete tenant. Record not found." };
      }
      // P2003: Foreign key constraint failure (e.g., if Bills reference an Agreement by this Tenant, and agreements were not properly checked)
      if (error.code === 'P2003') {
        return { success: false, error: "Cannot delete this tenant as they are referenced by other records (e.g., historical bills or other non-active agreements not caught by the check). Please ensure all dependencies are cleared or consider archiving." };
      }
    }
    return { success: false, error: error.message || "Failed to delete tenant." };
  }
}

