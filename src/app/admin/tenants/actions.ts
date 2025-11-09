
"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma, type User as PrismaUser, type Role as PrismaRole, TenantStatus } from '@prisma/client';
import { addMonths, isAfter } from 'date-fns'; 
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/services/emailService';
import { getUserAndPermissions, getUserAndManagedIds } from '@/lib/actions/server-helpers';
import bcrypt from 'bcrypt';

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

    // --- Step 2: Check for an existing User account ---
    const existingUser = await databaseService.findUserByEmailOrPhone(data.email, data.phone);

    let userForTenant: PrismaUser;
    let tempPassword: string | undefined = undefined;

    if (existingUser) {
        userForTenant = existingUser;
    } else {
        tempPassword = generateTempPassword();
        
        const tenantRole = await databaseService.getRoleByName('TENANT');
        if (!tenantRole) return { success: false, error: "The default 'TENANT' role was not found." };

        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        
        userForTenant = await databaseService.createUser({
            userId: `local-${crypto.randomUUID()}`,
            email: data.email,
            name: data.name,
            firstName: data.name.split(' ')[0] || data.name,
            lastName: data.name.split(' ').slice(1).join(' ') || 'Tenant',
            phoneNumber: data.phone,
            password: hashedPassword,
            tempPassword: tempPassword, // Store the plain temp password
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
      createdBy: { connect: { id: adminUser.id } }, // Associate tenant with creator
    });

    revalidatePath('/admin/tenants');
    return { success: true, tenant: newTenant, tempPassword: tempPassword };
  } catch (error: any) {
    console.error("Error creating tenant:", error);
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
    console.error("Error updating tenant:", error);
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
    // This is the corrected line. We need the full user object with permissions.
    const { currentUser, isSuperAdmin, permissions } = await getUserAndPermissions();
    const { managedBuildingIds } = await getUserAndManagedIds();

    if (!isSuperAdmin && !permissions.has('tenant:status')) {
        return { success: false, error: "You do not have permission to change a tenant's status." };
    }
    
    // Find all agreements for the tenant within the admin's managed buildings.
    const agreements = await prisma.agreement.findMany({
        where: {
            tenantId: tenantId,
            space: {
                buildingId: { in: managedBuildingIds ?? undefined } // Super admin has no buildingId filter
            }
        },
        select: { id: true }
    });
    
    const agreementIds = agreements.map(a => a.id);

    if (newStatus === 'Inactive') {
        // Create DisabledAgreement records for all relevant agreements.
        if (agreementIds.length > 0) {
            await prisma.disabledAgreement.createMany({
                data: agreementIds.map(agreementId => ({
                    agreementId: agreementId,
                    disabledById: currentUser.id
                })),
                skipDuplicates: true // Ignore if a record already exists
            });
        }
    } else { // 'Active'
        // Delete DisabledAgreement records for the relevant agreements created by this admin.
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
    console.error(`Error changing tenant ${tenantId} status to ${newStatus}:`, error);
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
            // No need to check for tenant role here. Any user can become a tenant.
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
        return { success: false, error: "No user found with this phone number. Please register them first." };
    } catch (error: any) {
        console.error("Error finding user by phone:", error);
        return { success: false, error: "An internal error occurred." };
    }
}

    