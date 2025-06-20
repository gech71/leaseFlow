
// src/app/portal/dashboard/actions.ts
"use server";

import { databaseService } from '@/lib/services/databaseService';
import { generateAgreementAction, type AgreementInput } from '@/app/actions';
import type { Agreement as AgreementPrisma, Bill as BillPrisma, Space as SpacePrisma, Building as BuildingPrisma, Tenant as TenantPrisma, PenaltyTier as PenaltyTierPrisma, UtilityBreakdownItem as UtilityBreakdownItemPrisma, Prisma } from '@prisma/client';
import { addMonths, isAfter } from 'date-fns';

// Define a simple structure for parsed utility items
interface ParsedUtilityItemForAction {
  id?: string;
  name: string;
  amount: number;
}

// Types that match the structure of data fetched with Prisma, including relations
// These are the rich types returned by Prisma. Serialization to client-friendly types happens in the page component.
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
  // Bills are now part of the agreement object, so no separate bills array here.
  error?: string;
}

export async function getTenantPortalDashboardDataAction(): Promise<TenantPortalData> {
  try {
    // For now, fetch the first tenant with an active agreement
    // In a real app, you'd get the logged-in tenant's ID
    const allAgreementsRaw = await databaseService.getAllAgreements({
      include: {
        tenant: true,
        space: {
          include: {
            building: {
              include: { penaltyPolicyTiers: true },
            },
          },
        },
        bills: { // Bills are included, but utilityBreakdown within bills will be processed manually
          orderBy: { billDate: 'desc' },
        },
      },
      orderBy: { createdAt: 'asc' } 
    });
    
    const processedAgreements = allAgreementsRaw.map(ag => {
      const processedBills = ag.bills.map(rawBill => {
        let parsedItems: ParsedUtilityItemForAction[] = [];
        const rawUtilityData = (rawBill as any).utilityBreakdown; // Access the raw field

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
        
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { utilityBreakdown: _originalScalarUtilityData, ...billData } = rawBill;
        return { ...billData, utilityBreakdown: parsedItems };
      });
      return { ...ag, bills: processedBills };
    });


    let targetAgreement: PortalAgreementWithRelations | null = null;
    for (const ag of processedAgreements) { // Iterate over processedAgreements
        const agreementEndDate = addMonths(new Date(ag.startDate), ag.paymentTermMonths);
        if (isAfter(agreementEndDate, new Date())) {
            targetAgreement = ag as PortalAgreementWithRelations; // Cast is now safer
            break;
        }
    }

    if (!targetAgreement) {
      return { agreement: null, aiGeneratedAgreementText: null, error: "No active agreement found for any tenant." };
    }

    const agreementInputForAI: AgreementInput = {
      tenantName: targetAgreement.tenant.name,
      building: targetAgreement.space.building.name,
      spaceId: targetAgreement.space.spaceIdName,
      spaceArea: targetAgreement.space.area,
      floor: targetAgreement.space.floor,
      monthlyRentalPrice: targetAgreement.monthlyRentalPrice,
      paymentTermMonths: targetAgreement.paymentTermMonths,
      initialPaymentMonths: targetAgreement.initialPaymentMonths,
      additionalTerms: targetAgreement.additionalTerms || "",
    };

    let aiGeneratedText: string | null = null;
    let aiError: string | null = null;

    try {
      const aiResult = await generateAgreementAction(agreementInputForAI);
      if ('error' in aiResult) {
        aiError = aiResult.error;
      } else {
        aiGeneratedText = aiResult.agreementText;
      }
    } catch (e: any) {
      console.error("AI Agreement Generation Error in Portal Action:", e);
      aiError = e.message || "An unexpected error occurred while generating agreement text.";
    }
    
    return {
      agreement: targetAgreement,
      aiGeneratedAgreementText: aiGeneratedText,
      error: aiError || undefined,
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
      // Payment date, method, etc., are usually set by admin during verification or if tenant pre-fills.
      // For this simulation, we just update status and proof.
    });
    return { success: true, bill: updatedBill };
  } catch (error: any) {
    console.error("Error submitting payment proof:", error);
    return { success: false, error: error.message || "Failed to submit payment proof." };
  }
}
