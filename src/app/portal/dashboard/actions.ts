
// src/app/portal/dashboard/actions.ts
"use server";

import { databaseService } from '@/lib/services/databaseService';
import type { Agreement as AgreementPrisma, Bill as BillPrisma, Space as SpacePrisma, Building as BuildingPrisma, Tenant as TenantPrisma, PenaltyTier as PenaltyTierPrisma, User, Role } from '@prisma/client';
import { addMonths, isAfter } from 'date-fns';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

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
  error?: string;
}

// --- User Authentication Helpers ---
const PORTAL_ACCESS_TOKEN_KEY = 'leaseflow_portal_access_token';

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
    const accessToken = cookieStore.get(PORTAL_ACCESS_TOKEN_KEY)?.value;

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
        console.error(`Portal Auth Error: User with external ID (sub) '${tokenPayload.sub}' not found in the local database.`);
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

    if (bill.agreement?.tenant?.user?.id !== currentUser.id) {
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
