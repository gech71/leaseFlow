
// src/app/portal/dashboard/actions.ts
"use server";

import { databaseService } from '@/lib/services/databaseService';
import type { Agreement as AgreementPrisma, Bill as BillPrisma, Space as SpacePrisma, Building as BuildingPrisma, Tenant as TenantPrisma, PenaltyTier as PenaltyTierPrisma, UtilityBreakdownItem as UtilityBreakdownItemPrisma, User, Role } from '@prisma/client';
import { addMonths, isAfter } from 'date-fns';
import { cookies, headers } from 'next/headers';

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

// Gets current user from cookie or Bearer token
async function getCurrentUser(): Promise<(User & { roles: Role[] }) | null> {
    const cookieStore = cookies();
    const headerList = headers();
    const authHeader = headerList.get('Authorization');

    let accessToken: string | undefined;
    let authMethod: 'cookie' | 'bearer' | 'none' = 'none';

    if (authHeader && authHeader.startsWith('Bearer ')) {
        accessToken = authHeader.substring(7);
        authMethod = 'bearer';
        console.log("Portal Auth: Attempting authentication via Bearer token.");
    } else {
        accessToken = cookieStore.get(PORTAL_ACCESS_TOKEN_KEY)?.value;
        if (accessToken) {
            authMethod = 'cookie';
            console.log("Portal Auth: Attempting authentication via cookie.");
        }
    }

    if (!accessToken) {
        console.error("Portal Auth Error: No access token found in cookie or Authorization header.");
        return null; // The action will handle the user-facing error message.
    }

    const tokenPayload = await decodeJwtPayload(accessToken);
    if (!tokenPayload || !tokenPayload.sub) {
        console.error(`Portal Auth Error: Failed to decode access token or 'sub' claim is missing. Method: ${authMethod}.`);
        return null;
    }
    
    console.log(`Portal Auth: Token decoded successfully for sub: ${tokenPayload.sub}. Fetching user from DB.`);

    const user = await databaseService.getUserByExternalId(tokenPayload.sub, { roles: true });

    if (!user) {
        console.error(`Portal Auth Error: User with external ID (sub) '${tokenPayload.sub}' not found in the local database.`);
    } else {
        console.log(`Portal Auth: Successfully found local user '${user.name}' for external ID '${tokenPayload.sub}'.`);
    }

    return user;
}


export async function getTenantPortalDashboardDataAction(): Promise<TenantPortalData> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      // The detailed error is logged in getCurrentUser, so the client gets a clean message.
      return { agreement: null, aiGeneratedAgreementText: null, error: "Authentication token missing or invalid. Please ensure the token is provided in the 'Authorization' header." };
    }

    // Find the tenant record associated with the logged-in user's email or phone number
    const associatedTenant = await databaseService.findTenantByEmailOrPhone(currentUser.email, currentUser.phoneNumber);
    
    // If no tenant record matches the logged-in user's details, return an error.
    if (!associatedTenant) {
        console.error(`Portal Data Error: User '${currentUser.email}' is authenticated but not associated with any tenant record.`);
        return { agreement: null, aiGeneratedAgreementText: null, error: "Your user account is not associated with any tenant profile. Please contact property management." };
    }
    console.log(`Portal Data: Found tenant '${associatedTenant.name}' for user '${currentUser.email}'.`);
    
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
      return { agreement: null, aiGeneratedAgreementText: null, error: "You do not have an active rental agreement on file." };
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
  paymentMethod: string;
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
      paymentMethod: input.paymentMethod,
    });
    return { success: true, bill: updatedBill };
  } catch (error: any) {
    console.error("Error submitting payment proof:", error);
    return { success: false, error: error.message || "Failed to submit payment proof." };
  }
}

const VALIDATE_TOKEN_URL = process.env.NIB_VALIDATE_TOKEN_URL;

export interface ConnectionResult {
  status: 'success' | 'error';
  message: string;
  token?: string | null;
  phone?: string | null;
}

export async function validateTokenFromHeaderAction(): Promise<ConnectionResult> {
  const headerList = headers();
  const authHeader = headerList.get('Authorization');

  if (!authHeader) {
    return { status: 'error', message: 'Authorization header is missing from the request.' };
  }

  if (!authHeader.startsWith('Bearer ')) {
    return { status: 'error', message: 'Authorization header is malformed. It must start with "Bearer ".' };
  }

  const token = authHeader.substring(7);
  if (!token) {
    return { status: 'error', message: 'Token is missing from the Authorization header after "Bearer ".', token };
  }

  if (!VALIDATE_TOKEN_URL) {
    console.error('❌ VALIDATE_TOKEN_URL is not configured.');
    return { status: 'error', message: 'Token validation service is not configured on the server.', token };
  }

  try {
    const externalResponse = await fetch(VALIDATE_TOKEN_URL, {
      method: 'GET',
      headers: { Authorization: authHeader, Accept: 'application/json' },
      cache: 'no-store',
    });

    const raw = await externalResponse.text();
    if (!raw) {
      return { status: 'error', message: 'Token validation failed: empty response from server.', token };
    }

    let responseData: any;
    try {
      responseData = JSON.parse(raw);
    } catch (err) {
      return { status: 'error', message: 'Token validation failed: backend response was not valid JSON.', token };
    }

    if (!externalResponse.ok) {
      return { status: 'error', message: responseData?.message || 'The provided token is invalid or expired.', token };
    }

    if (responseData.phone) {
      return { status: 'success', message: 'Token successfully validated.', token, phone: responseData.phone };
    } else {
      return { status: 'error', message: "Token validated but 'phone' was missing from the response.", token };
    }
  } catch (error: any) {
    console.error('❌ Error during token validation:', error.message);
    return { status: 'error', message: 'An internal error occurred while validating the token.', token };
  }
}
