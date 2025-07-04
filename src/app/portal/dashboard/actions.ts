
// src/app/portal/dashboard/actions.ts
"use server";

import { databaseService } from '@/lib/services/databaseService';
import type { Agreement as AgreementPrisma, Bill as BillPrisma, Space as SpacePrisma, Building as BuildingPrisma, Tenant as TenantPrisma, PenaltyTier as PenaltyTierPrisma, UtilityBreakdownItem as UtilityBreakdownItemPrisma, User, Role } from '@prisma/client';
import { addMonths, isAfter } from 'date-fns';
import { cookies } from 'next/headers';

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
    };
  };
  tenant: TenantPrisma;
  bills: (Omit<BillPrisma, 'utilityBreakdown'> & { utilityBreakdown: ParsedUtilityItemForAction[] })[];
};


export interface TenantPortalData {
  agreement: PortalAgreementWithRelations | null;
  aiGeneratedAgreementText: string | null;
  error?: string;
}

// --- User Authentication Helpers ---
const ACCESS_TOKEN_KEY = 'leaseflow_access_token';

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
    console.error('Failed to decode JWT payload:', e);
    return null;
  }
}

// Gets current user from cookie
async function getCurrentUser(): Promise<(User & { roles: Role[] }) | null> {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_TOKEN_KEY)?.value;
    if (!accessToken) return null;
    
    const tokenPayload = await decodeJwtPayload(accessToken);
    if (!tokenPayload || !tokenPayload.sub) return null;

    return await databaseService.getUserByExternalId(tokenPayload.sub, { roles: true });
}


export async function getTenantPortalDashboardDataAction(): Promise<TenantPortalData> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { agreement: null, aiGeneratedAgreementText: null, error: "Not authenticated. Please log in to view your portal." };
    }

    // Find the tenant record associated with the logged-in user's email or phone number
    const associatedTenant = await databaseService.findTenantByEmailOrPhone(currentUser.email, currentUser.phoneNumber);
    
    // If no tenant record matches the logged-in user's details, return an error.
    // This applies to all users, including admins, to avoid showing a confusing/incorrect portal.
    if (!associatedTenant) {
        return { agreement: null, aiGeneratedAgreementText: null, error: "Your user account is not associated with any tenant record. Please contact property management to have your portal access configured." };
    }
    
    const allAgreementsRaw = await databaseService.getAllAgreements({
      where: { tenantId: associatedTenant.id },
      include: {
        tenant: true,
        space: {
          include: {
            building: {
              include: { penaltyPolicyTiers: true },
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
      return { agreement: null, aiGeneratedAgreementText: null, error: "You do not have an active agreement." };
    }
    
    const agreementText = targetAgreement.agreementText;
    
    return {
      agreement: targetAgreement,
      aiGeneratedAgreementText: agreementText,
      error: undefined,
    };

  } catch (error: any) {
    console.error("Error fetching tenant portal data:", error);
    return { 
        agreement: null, 
        aiGeneratedAgreementText: null, 
        error: `Failed to fetch portal data: ${(error as Error).message}` 
    };
  }
}

export interface SubmitPaymentProofInput {
  billId: string;
  paymentProofUrl: string; // Simulate URL, actual upload not handled
  tenantPaymentNotes?: string;
}

export async function submitPaymentProofAction(input: SubmitPaymentProofInput) {
  try {
    const bill = await databaseService.getBillById(input.billId);
    if (!bill) {
      return { success: false, error: "Bill not found." };
    }
    if (bill.status === 'Paid') {
      return { success: false, error: "This bill is already marked as paid." };
    }

    const updatedBill = await databaseService.updateBill(input.billId, {
      status: 'PendingVerification',
      paymentProofUrl: input.paymentProofUrl,
      tenantPaymentNotes: input.tenantPaymentNotes,
    });
    return { success: true, bill: updatedBill };
  } catch (error: any) {
    console.error("Error submitting payment proof:", error);
    return { success: false, error: error.message || "Failed to submit payment proof." };
  }
}
