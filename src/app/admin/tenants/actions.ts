
"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma } from '@prisma/client';
import { addMonths, isAfter } from 'date-fns'; 
import { cookies } from 'next/headers';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;
const ADMIN_ACCESS_TOKEN_KEY = 'leaseflow_admin_access_token';

function generateTempPassword(length = 12) {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  // Ensure at least one of each character type
  let password = '';
  password += upper[Math.floor(Math.random() * upper.length)];
  password += lower[Math.floor(Math.random() * lower.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  const allChars = upper + lower + numbers + symbols;

  // Fill the rest of the password
  for (let i = 4; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password to make it more random
  return password.split('').sort(() => 0.5 - Math.random()).join('');
}


// This function now expects password and will trigger user registration
export async function createTenantAction(data: {
  name: string;
  email: string;
  phone: string;
  alternativePhone?: string;
  nationalId?: string;
  representativeName?: string;
  representativePhone?: string;
}) {
  try {
    // Generate a secure temporary password
    const tempPassword = generateTempPassword();

    // We can't directly call the API route from a server action.
    // However, we can simulate the fetch call to our own API endpoint.
    // This requires the full URL.
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 9002}`;
    
    // The registration API needs a logged-in admin's token, which is in cookies.
    // This server action runs in the context of that user, so we can forward the call.
    const { headers } = await import('next/headers');
    
    const registrationResponse = await fetch(`${baseUrl}/api/admin/register-user`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // Forward the cookie header from the original request to the API route
            'Cookie': (await headers()).get('Cookie') || "",
        },
        body: JSON.stringify({
            firstName: data.name.split(' ')[0] || data.name,
            lastName: data.name.split(' ').slice(1).join(' ') || 'Tenant',
            phoneNumber: data.phone,
            email: data.email,
            password: tempPassword, // Use the generated temporary password
            tempPassword: tempPassword, // Pass it along to be saved in the User model
        }),
    });

    const registrationResult = await registrationResponse.json();

    if (!registrationResponse.ok || !registrationResult.isSuccess) {
        console.error("Failed to register tenant user:", registrationResult.errors);
        return { success: false, error: `Failed to create user account: ${registrationResult.errors?.join(', ') || 'Unknown error'}` };
    }

    // Now that the user is created, create the tenant profile
    const newTenant = await databaseService.createTenant({
      name: data.name,
      email: data.email,
      phone: data.phone,
      alternativePhone: data.alternativePhone,
      nationalId: data.nationalId,
      representativeName: data.representativeName,
      representativePhone: data.representativePhone,
    });

    revalidatePath('/admin/tenants');
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
  data: Prisma.TenantUpdateInput
) {
  try {
    const updatedTenant = await databaseService.updateTenant(tenantId, data);
    revalidatePath('/admin/tenants');
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
