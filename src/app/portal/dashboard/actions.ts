
// src/app/portal/dashboard/actions.ts
"use server";

import { databaseService } from '@/lib/services/databaseService';
import type { Agreement as AgreementPrisma, Bill as BillPrisma, Space as SpacePrisma, Building as BuildingPrisma, Tenant as TenantPrisma, PenaltyTier as PenaltyTierPrisma, User, Role } from '@prisma/client';
import { addMonths, isAfter } from 'date-fns';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/services/emailService';

// Define a simple structure for parsed utility items
interface ParsedUtilityItemForAction {
  id?: string;
  name: string;
  amount: number;
}

// Types that match the structure of data fetched with Prisma, including relations
export type PortalAgreementWithRelations = Omit<AgreementPrisma, 'bills'> & {
  space: SpacePrisma & {
    building: BuildingPrisma & {
      penaltyPolicyTiers: PenaltyTierPrisma[];
      managers: User[]; // <-- Ensure managers are included
    };
  };
  tenant: TenantPrisma;
  bills: (Omit<BillPrisma, 'utilityBreakdown'> & { utilityBreakdown: ParsedUtilityItemForAction[] })[];
};


export interface TenantPortalData {
  agreement: PortalAgreementWithRelations | null;
  error?: string;
}

// --- User Authentication Helpers ---
const ACCESS_TOKEN_KEY = 'leaseflow_admin_access_token';

// Insecure JWT payload decoder
async function decodeJwtPayload(token: string): Promise<any | null> {
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
    console.error('Portal Auth Error: Failed to decode JWT payload:', e);
    return null;
  }
}

// Gets current user from the session cookie
async function getCurrentUser(): Promise<(User & { roles: Role[] }) | null> {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_TOKEN_KEY)?.value; // Use the unified token key

    if (!accessToken) {
        console.error("Portal Auth Error: No session access token found in cookie.");
        return null;
    }

    const tokenPayload = await decodeJwtPayload(accessToken);
    if (!tokenPayload || !tokenPayload.sub) {
        console.error(`Portal Auth Error: Failed to decode session token or 'sub' claim is missing.`);
        return null;
    }

    const user = await databaseService.getUserByExternalId(tokenPayload.sub, { roles: true });

    if (!user) {
        console.error(`Portal Auth Error: User with external ID (sub) '${tokenPayload.sub}' not found in the local system.`);
    }

    return user;
}


export async function getTenantPortalDashboardDataAction(): Promise<TenantPortalData> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { agreement: null, error: "Your session is invalid or has expired. Please re-enter from the Mini App or login page." };
    }

    // Find the tenant record associated with the logged-in user's email or phone number
    const associatedTenant = await databaseService.findTenantByEmailOrPhone(currentUser.email, currentUser.phoneNumber);
    
    if (!associatedTenant) {
        console.error(`Portal Data Error: User '${currentUser.email}' is authenticated but not associated with any tenant record.`);
        return { agreement: null, error: "Your user account is not associated with any tenant profile. Please contact property management." };
    }
    
    const allAgreementsRaw = await databaseService.getAllAgreements({
      where: { tenantId: associatedTenant.id },
      include: {
        tenant: true,
        space: {
          include: {
            building: {
              include: { 
                penaltyPolicyTiers: true,
                managers: true, // Fetch managers
              },
            },
          },
        },
        bills: {
          orderBy: { billDate: 'desc' },
        },
      },
      orderBy: { createdAt: 'asc' } 
    });
    
    const processedAgreements = allAgreementsRaw.map(ag => {
      const processedBills = ag.bills.map(rawBill => {
        let parsedItems: ParsedUtilityItemForAction[] = [];
        const rawUtilityData = (rawBill as any).utilityBreakdown;

        if (typeof rawUtilityData === 'string') {
          try {
            const jsonData = JSON.parse(rawUtilityData);
            if (Array.isArray(jsonData)) {
              parsedItems = jsonData
                .filter(item => typeof item.name === 'string' && typeof item.amount === 'number')
                .map(item => ({
                  name: item.name,
                  amount: item.amount,
                  id: typeof item.id === 'string' ? item.id : undefined,
                }));
            }
          } catch (e) {
            console.error(`Portal Action: Failed to parse utilityBreakdown JSON for bill ${rawBill.id}:`, e);
          }
        } else if (Array.isArray(rawUtilityData)) { 
            parsedItems = rawUtilityData
                .filter(item => typeof item.name === 'string' && typeof item.amount === 'number')
                .map(item => ({
                  name: item.name,
                  amount: item.amount,
                  id: typeof item.id === 'string' ? item.id : undefined,
                }));
        }
        
        const { utilityBreakdown: _originalScalarUtilityData, ...billData } = rawBill;
        return { ...billData, utilityBreakdown: parsedItems };
      });
      return { ...ag, bills: processedBills };
    });

    let targetAgreement: PortalAgreementWithRelations | null = null;
    for (const ag of processedAgreements) { 
        const agreementEndDate = addMonths(new Date(ag.startDate), ag.paymentTermMonths);
        if (isAfter(agreementEndDate, new Date())) {
            targetAgreement = ag as PortalAgreementWithRelations;
            break;
        }
    }
    
    if (!targetAgreement) {
      targetAgreement = processedAgreements[processedAgreements.length - 1] as PortalAgreementWithRelations || null;
    }
    
    return {
      agreement: targetAgreement,
      error: undefined,
    };

  } catch (error: any) {
    console.error("Error fetching tenant portal data:", error);
    return { 
        agreement: null, 
        error: `Failed to fetch portal data: ${(error as Error).message}` 
    };
  }
}

export async function submitPaymentProofAction(
  billId: string,
  data: {
    paymentMethod: string;
    paymentReference: string;
    paymentProofUrl: string; // Placeholder for now
    notes?: string;
  }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "Authentication required." };
    }

    const bill = await databaseService.getBillById(billId, {
      agreement: { include: { tenant: { include: { user: true } } } }
    });

    if (!bill) {
      return { success: false, error: "Bill not found." };
    }

    if (bill.agreement?.tenant?.userId !== currentUser.id) {
       return { success: false, error: "Unauthorized. You can only submit payment for your own bills." };
    }
    
    await databaseService.updateBill(billId, {
      status: 'PendingVerification',
      paymentMethod: data.paymentMethod,
      paymentReference: data.paymentReference,
      paymentProofUrl: data.paymentProofUrl,
      tenantPaymentNotes: data.notes,
    });
    
    return { success: true };
    
  } catch (error: any) {
    console.error("Error submitting payment proof:", error);
    return { success: false, error: `Failed to submit proof: ${(error as Error).message}` };
  }
}

export async function sendContactEmailAction(formData: { subject: string; body: string }): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "Authentication required." };
    }

    const tenant = await databaseService.findTenantByEmailOrPhone(currentUser.email, currentUser.phoneNumber);
    if (!tenant) {
      return { success: false, error: "No tenant profile associated with your user account." };
    }
    
    const agreement = await prisma.agreement.findFirst({
      where: { tenantId: tenant.id },
      include: { space: { include: { building: { include: { managers: true } } } } },
      orderBy: { startDate: 'desc' }
    });
    
    if (!agreement?.space?.building?.managers || agreement.space.building.managers.length === 0) {
      return { success: false, error: "No manager is assigned to your building. Cannot send email." };
    }

    const managerEmails = agreement.space.building.managers.map(m => m.email).filter((email): email is string => !!email);

    if (managerEmails.length === 0) {
      return { success: false, error: "Building manager(s) do not have an email address configured." };
    }
    
    const emailHtml = `
      <h1>Contact Form Submission from Tenant Portal</h1>
      <p><strong>From Tenant:</strong> ${tenant.name} (${tenant.email})</p>
      <p><strong>Building:</strong> ${agreement.space.building.name}</p>
      <p><strong>Space:</strong> ${agreement.space.spaceIdName}</p>
      <hr>
      <h2>Subject: ${formData.subject}</h2>
      <p>${formData.body.replace(/\n/g, '<br>')}</p>
    `;

    // The `to` field can be a comma-separated string of emails
    // The `from` field is now customized for this action
    const result = await sendEmail({
      from: `"${tenant.name}" <${tenant.email}>`, // Use tenant's name and email as the sender
      to: managerEmails.join(', '),
      subject: `[Tenant Portal] ${formData.subject}`,
      html: emailHtml
    });

    if (!result.success) {
      throw new Error(result.error || "Email service failed.");
    }

    return { success: true };

  } catch (error: any) {
    console.error("Error in sendContactEmailAction:", error);
    return { success: false, error: `Failed to send message: ${error.message}` };
  }
}
