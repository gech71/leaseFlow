
// src/app/portal/dashboard/actions.ts
"use server";

import { databaseService } from '@/lib/services/databaseService';
import type { Agreement as AgreementPrisma, Bill as BillPrisma, Space as SpacePrisma, Building as BuildingPrisma, Tenant as TenantPrisma, PenaltyTier as PenaltyTierPrisma, User, Role } from '@prisma/client';
import { addMonths, isAfter, format } from 'date-fns';
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

export async function initiateArifpayPaymentAction(
  billId: string, 
  billAmount: number,
  billDate: string
): Promise<{ success: boolean; error?: string; paymentUrl?: string }> {
  const ARIFPAY_API_URL = process.env.ARIFPAY_API_URL;
  const ARIFPAY_API_KEY = process.env.ARIFPAY_API_KEY;
  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;

  if (!ARIFPAY_API_URL || !ARIFPAY_API_KEY || !BASE_URL) {
    console.error("ArifPay or Base URL environment variables are not configured.");
    return { success: false, error: "Payment service is not configured correctly." };
  }

  try {
    const currentUser = await getCurrentUser();
    if (!currentUser?.phoneNumber || !currentUser?.email) {
      return { success: false, error: "Your user profile is missing a phone number or email address." };
    }

    const bill = await prisma.bill.findUnique({
      where: { id: billId },
      include: { agreement: { include: { space: { include: { building: true } } } } }
    });

    if (!bill) {
      return { success: false, error: "Bill not found." };
    }
    if (!bill.agreement?.space?.building?.accountNumber) {
      return { success: false, error: "Building account number is not configured for this bill." };
    }

    const nonce = crypto.randomBytes(16).toString('hex');
    const transactionId = `${billId}__${nonce}`; // Make transactionId unique per attempt

    const requestBody = {
      nonce: nonce,
      successRedirectUrl: `${BASE_URL}/portal/success`,
      errorRedirectUrl: `${BASE_URL}/portal/error`,
      cancelRedirectUrl: `${BASE_URL}/portal/cancel`,
      notifyUrl: `${BASE_URL}/api/portal/Arifcallback`,
      paymentMethods: ["CARD", "TELEBIRR", "CBE_BIRR", "AWASH_BIRR"],
      expireDate: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes from now
      phone: currentUser.phoneNumber,
      email: currentUser.email,
      items: [
        {
          name: `Bill: ${format(new Date(billDate), 'yyyy-MM-dd')}`,
          quantity: 1,
          price: billAmount,
          description: `Bill payment for space ${bill.agreement.space.spaceIdName}`
        }
      ],
      beneficiaries: [
        {
            accountNumber: bill.agreement.space.building.accountNumber,
            bank: "NIB",
            amount: billAmount
        }
      ],
      transactionId: transactionId
    };

    const response = await fetch(ARIFPAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-arifpay-key': ARIFPAY_API_KEY,
      },
      body: JSON.stringify(requestBody),
    });

    const responseData = await response.json();
    
    if (responseData.code && responseData.code !== 200) {
      console.error("ArifPay API Error:", responseData);
      return { success: false, error: `Payment gateway error: ${responseData.message || "An unknown error occurred."}` };
    }
    
    if (!responseData.data?.paymentUrl) {
       console.error("ArifPay API Error - No URL:", responseData);
      return { success: false, error: "Payment gateway did not return a valid payment URL." };
    }

    await prisma.bill.update({
      where: { id: billId },
      data: {
        status: 'PendingVerification',
        tenantPaymentNotes: `Payment initiated via ArifPay. Session ID: ${responseData.data.sessionId}`
      }
    });

    return { success: true, paymentUrl: responseData.data.paymentUrl };

  } catch (error: any) {
    console.error("Error in initiateArifpayPaymentAction:", error);
    return { success: false, error: "An unexpected error occurred while initiating payment." };
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

    const result = await sendEmail({
      from: `"${tenant.name}" <${tenant.email}>`,
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
