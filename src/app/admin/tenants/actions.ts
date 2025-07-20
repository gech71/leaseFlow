
"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma } from '@prisma/client';
import { addMonths, isAfter } from 'date-fns';

// This function now expects password and will trigger user registration
export async function createTenantAction(data: {
  name: string;
  email: string;
  phone: string;
  password?: string; // Password is required for tenant user creation
  alternativePhone?: string;
  nationalId?: string;
  representativeName?: string;
  representativePhone?: string;
}) {
  const { password, ...tenantData } = data;

  if (!password) {
    return { success: false, error: "Password is required to create a user account for the tenant." };
  }

  try {
    // We can't directly call the API route from a server action.
    // However, we can simulate the fetch call to our own API endpoint.
    // This requires the full URL.
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 9002}`;
    
    // The registration API needs a logged-in admin's token, which is in cookies.
    // This server action runs in the context of that user, so we can forward the call.
    // NOTE: This approach is complex. A better long-term solution would be to
    // refactor user creation logic into a shared service that both the API and this action can call.
    // For now, this makes the feature work without major refactoring.
    const { headers } = await import('next/headers');
    
    const registrationResponse = await fetch(`${baseUrl}/api/admin/register-user`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // Forward the cookie header from the original request to the API route
            'Cookie': headers().get('Cookie') || "",
        },
        body: JSON.stringify({
            firstName: tenantData.name.split(' ')[0] || tenantData.name,
            lastName: tenantData.name.split(' ').slice(1).join(' ') || 'Tenant',
            phoneNumber: tenantData.phone,
            email: tenantData.email,
            password: password,
            isTenant: true // Flag to auto-assign TENANT role
        }),
    });

    const registrationResult = await registrationResponse.json();

    if (!registrationResponse.ok || !registrationResult.isSuccess) {
        console.error("Failed to register tenant user:", registrationResult.errors);
        return { success: false, error: `Failed to create user account: ${registrationResult.errors?.join(', ') || 'Unknown error'}` };
    }

    // Now that the user is created, create the tenant profile
    const newTenant = await databaseService.createTenant(tenantData);

    revalidatePath('/admin/tenants');
    return { success: true, tenant: newTenant };

  } catch (error: any) {
    console.error("Error creating tenant or user:", error);
    // Attempt to clean up if tenant was created but user failed, or vice-versa (though less likely with this flow)
    return { success: false, error: error.message || "Failed to create tenant and user account." };
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
    // Note: This does not delete the associated User account, only the Tenant profile.
    // Deleting the user should be a separate, deliberate action in User Management.
    const tenant = await databaseService.getTenantById(tenantId, {
      agreements: true,
    });

    if (!tenant) {
      return { success: false, error: "Tenant not found." };
    }

    if (tenant.agreements && tenant.agreements.length > 0) {
      const activeAgreements = tenant.agreements.filter(agreement => {
        const agreementEndDate = addMonths(agreement.startDate, agreement.paymentTermMonths);
        return isAfter(agreementEndDate, new Date());
      });
      if (activeAgreements.length > 0) {
        return { success: false, error: "Cannot delete tenant with active or future agreements. Please resolve or terminate these agreements first." };
      }
    }
    
    const spacesOccupiedByTenant = await databaseService.getAllSpaces({
        where: { tenantId: tenantId }
    });

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
