

"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma, type User as PrismaUser, type Role as PrismaRole, TenantStatus } from '@prisma/client';
import { addMonths, isAfter } from 'date-fns'; 
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/services/emailService';
import { getUserAndPermissions, getUserAndManagedIds } from '@/lib/actions/server-helpers';
import bcrypt from 'bcryptjs';

function generateTempPassword(length = 12): string {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const allChars = upper + lower + numbers + symbols;

    let password = '';
    const randomValues = new Uint32Array(length);
    crypto.getRandomValues(randomValues);

    password += upper[randomValues[0] % upper.length];
    password += lower[randomValues[1] % lower.length];
    password += numbers[randomValues[2] % numbers.length];
    password += symbols[randomValues[3] % symbols.length];

    for (let i = 4; i < length; i++) {
        password += allChars[randomValues[i] % allChars.length];
    }
    
    return password.split('').sort(() => 0.5 - (crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296)).join('');
}


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
    const { currentUser: adminUser } = await getUserAndPermissions();
    if (!adminUser) {
        return { success: false, error: "Admin session not found."};
    }
    
    const existingTenant = await databaseService.findTenantByEmailOrPhone(data.email, data.phone);

    if (existingTenant) {
      return { 
        success: false, 
        error: "A tenant with this email or phone number already exists." 
      };
    }

    const existingUser = await databaseService.findUserByEmailOrPhone(data.email, data.phone);

    let userForTenant: PrismaUser;
    let tempPassword: string | undefined = undefined;

    if (existingUser) {
        userForTenant = existingUser;
    } else {
        tempPassword = generateTempPassword();
        
        const tenantRole = await databaseService.getRoleByName('TENANT');
        if (!tenantRole) return { success: false, error: "The default 'TENANT' role was not found." };
        
        userForTenant = await databaseService.createUser({
            email: data.email,
            name: data.name,
            firstName: data.name.split(' ')[0] || data.name,
            lastName: data.name.split(' ').slice(1).join(' ') || 'Tenant',
            phoneNumber: data.phone,
            password: null, 
            tempPassword: tempPassword, 
            roles: { connect: { id: tenantRole.id } },
        });
        
        const emailHtml = `
          <h1>Welcome to LeaseFlow!</h1>
          <p>Hello ${data.name},</p>
          <p>A new tenant portal account has been created for you. You can use these credentials to log in and manage your lease.</p>
          <p>You can access the portal here: <a href="${process.env.NEXTAUTH_URL}/login">${process.env.NEXTAUTH_URL}/login</a></p>
          <p><strong>Phone Number:</strong> ${data.phone}</p>
          <p><strong>Temporary Password:</strong> ${tempPassword}</p>
          <p>For your security, you will be required to change this password upon your first login.</p>
          <p>Thank you,</p>
          <p>The Management Team</p>
        `;
        await sendEmail({ to: data.email, subject: 'Your New Tenant Portal Account Credentials', html: emailHtml });
    }

    const newTenant = await databaseService.createTenant({
      name: data.name,
      email: data.email,
      phone: data.phone,
      alternativePhone: data.alternativePhone,
      nationalId: data.nationalId,
      representativeName: data.representativeName,
      representativePhone: data.representativePhone,
      user: { connect: { id: userForTenant.id } },
      createdBy: { connect: { id: adminUser.id } }, 
    });

    revalidatePath('/admin/tenants');
    return { success: true, tenant: newTenant, tempPassword: tempPassword };
  } catch (error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = (error.meta?.target as string[]) || [];
      const fieldName = target.join(', ');
      return { success: false, error: `Failed to create tenant. A tenant with the same ${fieldName} already exists.` };
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
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        const target = (error.meta?.target as string[]) || [];
        const fieldName = target.join(', ');
        return { success: false, error: `Failed to update tenant. A tenant with the same ${fieldName} already exists.` };
      }
      if (error.code === 'P2025') { 
        return { success: false, error: "Failed to update tenant. Record not found." };
      }
    }
    return { success: false, error: error.message || "Failed to update tenant." };
  }
}


export async function toggleTenantStatusAction(tenantId: string, newStatus: 'Active' | 'Inactive'): Promise<{ success: boolean; error?: string }> {
  try {
    const { currentUser, isSuperAdmin, permissions } = await getUserAndPermissions();
    const { managedBuildingIds } = await getUserAndManagedIds();

    if (!isSuperAdmin && !permissions.has('tenant:status')) {
        return { success: false, error: "You do not have permission to change a tenant's status." };
    }
    
    const agreements = await prisma.agreement.findMany({
        where: {
            tenantId: tenantId,
            space: {
                buildingId: { in: managedBuildingIds ?? undefined } 
            }
        },
        select: { id: true }
    });
    
    const agreementIds = agreements.map(a => a.id);

    if (newStatus === 'Inactive') {
        if (agreementIds.length > 0) {
            await prisma.disabledAgreement.createMany({
                data: agreementIds.map(agreementId => ({
                    agreementId: agreementId,
                    disabledById: currentUser.id
                })),
                skipDuplicates: true 
            });
        }
    } else { 
        if (agreementIds.length > 0) {
             await prisma.disabledAgreement.deleteMany({
                where: {
                    agreementId: { in: agreementIds },
                    disabledById: currentUser.id
                }
            });
        }
    }

    revalidatePath('/admin/tenants');
    return { success: true };

  } catch (error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return { success: false, error: "Tenant not found." };
    }
    return { success: false, error: `Failed to set tenant status to ${newStatus}.` };
  }
}

export async function findUserByPhoneAction(phone: string): Promise<{ success: boolean; user?: { name: string; email: string; nationalId?: string | null; }; error?: string }> {
    if (!phone) {
        return { success: false, error: "Phone number is required." };
    }
    try {
        const user = await databaseService.findUserByPhoneNumber(phone, { roles: true });
        
        if (user) {
            const hasOtherRoles = user.roles.some(role => role.name !== 'TENANT');
            
            if (hasOtherRoles) {
                return { success: false, error: "Tenant not found." };
            }

            const tenant = await databaseService.findTenantByEmailOrPhone(null, phone);
            return { 
                success: true, 
                user: { 
                    name: user.name || `${user.firstName} ${user.lastName}`, 
                    email: user.email,
                    nationalId: tenant?.nationalId
                } 
            };
        }
        return { success: false, error: "Tenant not found." };
    } catch (error: any) {
        return { success: false, error: "An internal error occurred." };
    }
}
