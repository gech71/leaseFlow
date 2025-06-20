
"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma, type Agreement } from '@prisma/client';
import { addMonths, parseISO } from 'date-fns';

export interface CreateFullAgreementData {
  // IDs for relations
  tenantId: string;
  spaceId: string;
  
  // Details for the agreement itself, often from form + AI
  agreementText: string;
  startDate: string; // ISO String from client
  monthlyRentalPrice: number; // From selected space
  paymentTermMonths: number;
  initialPaymentMonths: number;
  additionalTerms?: string | null;
  
  // Initial Payment details from form
  initialPaymentMethod: string;
  initialPaymentReference?: string | null;
  initialPaymentBankOrWalletName?: string | null;
}

export async function createFullAgreementAction(input: CreateFullAgreementData) {
  try {
    const startDateObj = parseISO(input.startDate);
    const nextPaymentDueDateObj = addMonths(startDateObj, input.initialPaymentMonths);
    const initialPaymentAmount = input.monthlyRentalPrice * input.initialPaymentMonths;

    const agreementToCreate: Prisma.AgreementCreateInput = {
      agreementText: input.agreementText,
      startDate: startDateObj,
      monthlyRentalPrice: input.monthlyRentalPrice,
      paymentTermMonths: input.paymentTermMonths,
      initialPaymentMonths: input.initialPaymentMonths,
      nextPaymentDueDate: nextPaymentDueDateObj,
      additionalTerms: input.additionalTerms,
      
      initialPaymentAmount: initialPaymentAmount,
      initialPaymentMethod: input.initialPaymentMethod,
      initialPaymentReference: input.initialPaymentReference,
      initialPaymentBankOrWalletName: (input.initialPaymentMethod === "Bank Transfer" || input.initialPaymentMethod === "Wallet") ? input.initialPaymentBankOrWalletName : undefined,
      initialPaymentDate: startDateObj, // Assuming initial payment is made on start date

      tenant: { connect: { id: input.tenantId } },
      space: { connect: { id: input.spaceId } },
    };

    const newAgreement = await databaseService.createAgreement(agreementToCreate);

    // Update space to be occupied by this tenant
    await databaseService.updateSpace(input.spaceId, {
      isOccupied: true,
      tenant: { connect: { id: input.tenantId } },
    });

    // Update tenant's rentedSpaceId
    await databaseService.updateTenant(input.tenantId, {
      rentedSpace: { connect: { id: input.spaceId } },
    });

    revalidatePath('/admin/agreements');
    revalidatePath('/admin/agreements/generate');
    revalidatePath('/admin/spaces'); // Space occupancy changed
    revalidatePath('/admin/tenants'); // Tenant's rentedSpace changed
    return { success: true, agreement: newAgreement };
  } catch (error: any) {
    console.error("Error creating agreement in DB:", error);
    let errorMessage = "Failed to create agreement.";
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') { 
        errorMessage = "Failed to create agreement. A similar agreement might already exist or related data conflict (e.g. space already linked).";
      } else if (error.code === 'P2025') {
        errorMessage = "Failed to create agreement. Tenant or Space not found.";
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
}

export async function deleteAgreementAction(agreementId: string) {
    try {
        const agreement = await databaseService.getAgreementById(agreementId, { // Corrected: Pass include options directly
            bills: true, 
            space: true 
        });
        if (!agreement) {
            return { success: false, error: "Agreement not found." };
        }

        if (agreement.bills && agreement.bills.length > 0) {
            return { success: false, error: "Cannot delete agreement with associated bills. Please resolve bills first." };
        }

        // Vacate space if this was the active agreement for it
        if (agreement.space && agreement.space.tenantId === agreement.tenantId) {
             // Check if there are other active agreements for this space and tenant before vacating
            const otherAgreements = await databaseService.getAllAgreements({
                where: { 
                    spaceId: agreement.spaceId, 
                    tenantId: agreement.tenantId, 
                    id: { not: agreementId },
                    // Add date checks if needed to define "active"
                }
            });
            if (otherAgreements.length === 0) { // Only vacate if no other agreements link tenant to this space
                await databaseService.updateSpace(agreement.spaceId, {
                    isOccupied: false,
                    tenant: { disconnect: true }
                });
                 await databaseService.updateTenant(agreement.tenantId, {
                    rentedSpace: { disconnect: true }
                });
            }
        }
        
        await databaseService.deleteAgreement(agreementId);
        revalidatePath('/admin/agreements');
        revalidatePath('/admin/spaces');
        revalidatePath('/admin/tenants');
        return { success: true };
    } catch (error: any) {
        console.error("Error deleting agreement:", error);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return { success: false, error: "Failed to delete agreement. Record not found." };
        }
        return { success: false, error: error.message || "Failed to delete agreement." };
    }
}

