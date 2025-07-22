
"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma, type User as PrismaUser, type Role as PrismaRole } from '@prisma/client';
import { addMonths, isAfter } from 'date-fns'; 
import { cookies, headers } from 'next/headers';
import { prisma } from '@/lib/prisma';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL;
const ADMIN_ACCESS_TOKEN_KEY = 'leaseflow_admin_access_token';

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
    
    const requestHeaders = await headers();
    
    const registrationResponse = await fetch(`${AUTH_API_BASE_URL}/api/Auth/register`, {
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
        }),
    });

    const responseText = await registrationResponse.text();

    if (!registrationResponse.ok) {
        let errorMessages = ["Failed to register user account."];
        try {
            if (responseText) {
                const errorJson = JSON.parse(responseText);
                errorMessages = errorJson.errors || [errorJson.message] || errorMessages;
            }
        } catch (e) {
            // Ignore if parsing fails, use the raw text if it's not too long
            if(responseText && responseText.length < 500) {
              errorMessages = [responseText];
            }
        }
        console.error("Failed to register tenant user:", errorMessages);
        return { success: false, error: `Failed to create user account: ${errorMessages.join(', ')}` };
    }
    
    // To get the new user's ID, we have to log them in to get a token
    const loginResponse = await fetch(`${AUTH_API_BASE_URL}/api/Auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: data.phone, password: tempPassword }),
    });

    if (!loginResponse.ok) {
        return { success: false, error: "User registered, but failed to retrieve user ID for local setup." };
    }

    const loginData = await loginResponse.json();
    const tokenPayload = decodeJwtPayload(loginData.accessToken);
    const newUserId = tokenPayload?.sub;
    
    if (!newUserId) {
      return { success: false, error: "User was created, but the new User ID was not returned." };
    }

    // Now that the user is created, find the TENANT role and assign it.
    const tenantRole = await databaseService.getRoleByName('TENANT');
    if (!tenantRole) {
      return { success: false, error: "The default 'TENANT' role was not found. Please seed the application."};
    }

    // Create the local User record first
     const newUser = await databaseService.createUser({
        userId: newUserId,
        email: data.email,
        name: data.name,
        firstName: data.name.split(' ')[0] || data.name,
        lastName: data.name.split(' ').slice(1).join(' ') || 'Tenant',
        phoneNumber: data.phone,
        tempPassword: tempPassword, // Save the temporary password
        roles: { connect: { id: tenantRole.id } }
    });
    
    // Now create the tenant profile linked to the new user
    const newTenant = await databaseService.createTenant({
      name: data.name,
      email: data.email,
      phone: data.phone,
      alternativePhone: data.alternativePhone,
      nationalId: data.nationalId,
      representativeName: data.representativeName,
      representativePhone: data.representativePhone,
      user: { connect: { id: newUser.id } }
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

// Insecure JWT payload decoder
function decodeJwtPayload(token: string): any | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Failed to decode JWT payload:', e);
    return null;
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
        const cookieStore = await cookies();
        const adminAccessToken = cookieStore.get(ADMIN_ACCESS_TOKEN_KEY)?.value;

        if (!adminAccessToken) {
            return { success: false, error: "Admin authentication token not found." };
        }
        
        const response = await fetch(`${AUTH_API_BASE_URL}/api/Auth/delete-users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminAccessToken}`,
            },
            body: JSON.stringify({ phoneNumbers: [phoneNumber] }),
        });
        
        if (response.ok) {
            return { success: true };
        }
        
        const errorText = await response.text();
        let errorMessage = `Failed with status ${response.status}`;
        if (errorText) {
            try {
                const errorData = JSON.parse(errorText);
                errorMessage = errorData?.errors?.join(', ') || errorData?.message || errorText;
            } catch (e) {
                errorMessage = errorText.substring(0, 150);
            }
        }
        
        console.error("Failed to delete user from identity server:", errorMessage);
        return { success: false, error: errorMessage };

    } catch (error: any) {
        console.error("Error calling delete user endpoint on identity server:", error);
        return { success: false, error: "Could not connect to the identity service to delete user." };
    }
}


export async function deleteTenantAction(tenantId: string) {
  try {
    const tenant = await databaseService.getTenantById(tenantId, {
      agreements: true,
      user: true, 
      rentedSpace: true,
    });

    if (!tenant) {
      return { success: false, error: "Tenant not found." };
    }
    
    const hasActiveAgreements = tenant.agreements.some(agreement =>
      isAfter(addMonths(agreement.startDate, agreement.paymentTermMonths), new Date())
    );
    if (hasActiveAgreements) {
      return { success: false, error: "Cannot delete tenant with active or future agreements. Please resolve these first." };
    }
    
    if (tenant.phone) {
      const identityDeletionResult = await deleteIdentityServerUser(tenant.phone);
      if (!identityDeletionResult.success) {
        return { success: false, error: `Failed to delete from identity server: ${identityDeletionResult.error}. Local data not deleted.` };
      }
    }
    
    await prisma.$transaction(async (tx) => {
      // Unlink the tenant from their space to make it vacant
      if (tenant.rentedSpace) {
        await tx.space.update({
          where: { id: tenant.rentedSpace.id },
          data: {
            isOccupied: false,
            tenant: {
              disconnect: true
            }
          }
        });
      }

      await tx.tenant.delete({
        where: { id: tenantId }
      });
      
      if (tenant.user?.userId) {
        await tx.user.delete({
          where: { userId: tenant.user.userId }
        });
      }
    });

    revalidatePath('/admin/tenants');
    revalidatePath('/admin/spaces'); 
    return { success: true };
  } catch (error: any)
   {
    console.error("Error deleting tenant:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { 
        console.warn(`Prisma P2025 error during tenant deletion, likely a race condition or unexpected cascade. Considering it a success. Error: ${error.message}`);
        revalidatePath('/admin/tenants');
        return { success: true };
      }
      if (error.code === 'P2003') {
        return { success: false, error: "Cannot delete this tenant as they are referenced by other records (e.g., historical bills or other non-active agreements). Please ensure all dependencies are cleared or consider archiving." };
      }
    }
    return { success: false, error: error.message || "Failed to delete tenant." };
  }
}
