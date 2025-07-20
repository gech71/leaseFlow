
"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma } from '@prisma/client';
import { addMonths, isAfter } from 'date-fns'; 
import { cookies, headers } from 'next/headers';
import { prisma } from '@/lib/prisma';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;

function generateTempPassword(length = 12) {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  let password = '';
  password += upper[Math.floor(Math.random() * upper.length)];
  password += lower[Math.floor(Math.random() * lower.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  const allChars = upper + lower + numbers + symbols;

  for (let i = 4; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

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
    const tempPassword = generateTempPassword();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 9002}`;
    
    const requestHeaders = await headers();
    
    const registrationResponse = await fetch(`${baseUrl}/api/admin/register-user`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': requestHeaders.get('Cookie') || "",
        },
        body: JSON.stringify({
            firstName: data.name.split(' ')[0] || data.name,
            lastName: data.name.split(' ').slice(1).join(' ') || 'Tenant',
            phoneNumber: data.phone,
            email: data.email,
            password: tempPassword,
            tempPassword: tempPassword,
        }),
    });

    const registrationResult = await registrationResponse.json();

    if (!registrationResponse.ok || !registrationResult.isSuccess) {
        console.error("Failed to register tenant user:", registrationResult.errors);
        return { success: false, error: `Failed to create user account: ${registrationResult.errors?.join(', ') || 'Unknown error'}` };
    }
    
    const newUserId = registrationResult.userId;
    if (!newUserId) {
      return { success: false, error: "User was created, but the new User ID was not returned." };
    }

    // Now that the user is created, find the TENANT role and assign it.
    const tenantRole = await databaseService.getRoleByName('TENANT');
    if (!tenantRole) {
      return { success: false, error: "The default 'TENANT' role was not found in the database. Please seed the database."};
    }

    // Find the newly created user by their external ID
    const newUser = await databaseService.getUserByExternalId(newUserId);
    if (!newUser) {
      return { success: false, error: "Could not find the newly created user in the local database to assign a role." };
    }

    // Assign the TENANT role
    await databaseService.updateUser(newUser.id, {
      roles: {
        connect: { id: tenantRole.id }
      }
    });

    // Now create the tenant profile
    const newTenant = await databaseService.createTenant({
      name: data.name,
      email: data.email,
      phone: data.phone,
      alternativePhone: data.alternativePhone,
      nationalId: data.nationalId,
      representativeName: data.representativeName,
      representativePhone: data.representativePhone,
      // Link the Tenant profile to the User profile
      user: { connect: { userId: newUserId } }
    });

    revalidatePath('/admin/tenants');
    return { success: true, tenant: newTenant, tempPassword: tempPassword };
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


async function deleteIdentityServerUser(phoneNumber: string) {
    if (!AUTH_API_BASE_URL) {
        console.error("Auth API base URL is not set. Cannot delete identity server user.");
        return { success: false, error: "Identity service is not configured." };
    }

    try {
        const requestHeaders = await headers();
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 9002}`;

        const response = await fetch(`${AUTH_API_BASE_URL}/api/Auth/delete-users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': requestHeaders.get('Authorization') || "",
            },
            body: JSON.stringify({ phoneNumbers: [phoneNumber] }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            const errorMessage = errorData?.errors?.join(', ') || `Failed with status ${response.status}`;
            console.error("Failed to delete user from identity server:", errorMessage);
            return { success: false, error: errorMessage };
        }

        return { success: true };
    } catch (error: any) {
        console.error("Error calling delete user endpoint on identity server:", error);
        return { success: false, error: "Could not connect to the identity service to delete user." };
    }
}


export async function deleteTenantAction(tenantId: string) {
  try {
    const tenant = await databaseService.getTenantById(tenantId, {
      agreements: true,
      user: true, // Also include the associated user
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

    const identityDeletionResult = await deleteIdentityServerUser(tenant.phone);
    if (!identityDeletionResult.success) {
      return { success: false, error: `Failed to delete the user account from the identity server: ${identityDeletionResult.error}. Local data was not deleted.` };
    }
    
    await databaseService.deleteTenant(tenantId);
    
    if (tenant.userId) {
       await prisma.user.delete({ where: { id: tenant.userId } }).catch(e => {
            console.error(`Failed to delete local user record ${tenant.userId}, but identity record was deleted. Manual cleanup may be required.`, e);
        });
    }


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
