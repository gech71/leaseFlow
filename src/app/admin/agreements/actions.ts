
"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma, type Agreement } from '@prisma/client';
import { addMonths, parseISO, isSameDay } from 'date-fns';
import { prisma } from '@/lib/prisma';

export interface CreateFullAgreementData {
  // IDs for relations
  tenantId: string;
  spaceId: string;
  agreementTemplateId: string;
  
  // Details for the agreement itself, often from form + AI
  agreementText: string;
  startDate: string; // ISO String from client
  monthlyRentalPrice: number; // From selected space
  paymentTermMonths: number;
  initialPaymentMonths: number;
  additionalTerms?: string | null;
}

export async function createFullAgreementAction(input: CreateFullAgreementData) {
  try {
    const startDateObj = parseISO(input.startDate);
    // The next due date is for the first monthly utility bill.
    const nextPaymentDueDateObj = addMonths(startDateObj, 1);
    const initialPaymentAmount = input.monthlyRentalPrice * input.initialPaymentMonths;

    const newAgreementId = await prisma.$transaction(async (tx) => {
      // 1. Create the Agreement
      const agreement = await tx.agreement.create({
        data: {
          agreementText: input.agreementText,
          startDate: startDateObj,
          monthlyRentalPrice: input.monthlyRentalPrice,
          paymentTermMonths: input.paymentTermMonths,
          initialPaymentMonths: input.initialPaymentMonths,
          nextPaymentDueDate: nextPaymentDueDateObj,
          additionalTerms: input.additionalTerms,
          
          initialPaymentAmount: initialPaymentAmount,
          initialPaymentDate: startDateObj,

          tenant: { connect: { id: input.tenantId } },
          space: { connect: { id: input.spaceId } },
          agreementTemplate: { connect: { id: input.agreementTemplateId } },
        }
      });

      // 2. Create a "Bill" for the initial payment, marked as Pending
      if (initialPaymentAmount > 0) {
        await tx.bill.create({
          data: {
            agreementId: agreement.id,
            tenantId: input.tenantId,
            billDate: startDateObj,
            dueDate: startDateObj,
            rentAmount: initialPaymentAmount,
            utilityBreakdown: Prisma.JsonNull,
            penaltyAmount: 0,
            totalAmount: initialPaymentAmount,
            status: 'Pending', // Not verified on creation
            paymentDate: null,
            paymentMethod: null,
            paymentReference: null,
            adminVerifiedPayment: false, 
          }
        });
      }

      // 3. Update space to be occupied by this tenant
      await tx.space.update({
        where: { id: input.spaceId },
        data: {
          isOccupied: true,
          tenant: { connect: { id: input.tenantId } },
        },
      });

      // 4. Update tenant's rentedSpaceId
      await tx.tenant.update({
        where: { id: input.tenantId },
        data: {
          rentedSpace: { connect: { id: input.spaceId } },
        },
      });
      
      return agreement.id;
    });

    // Re-fetch the agreement with all relations to ensure the returned object is complete
    const completeNewAgreement = await databaseService.getAgreementById(newAgreementId, {
      tenant: true,
      space: true
    });

    if (!completeNewAgreement) {
        throw new Error("Failed to re-fetch the newly created agreement.");
    }

    revalidatePath('/admin/agreements');
    revalidatePath('/admin/spaces'); // Space occupancy changed
    revalidatePath('/admin/tenants'); // Tenant's rentedSpace changed
    revalidatePath('/admin/billing'); // Invalidate billing page data
    
    // Convert Decimal fields to numbers before returning
    const serializableAgreement = {
      ...completeNewAgreement,
      monthlyRentalPrice: Number(completeNewAgreement.monthlyRentalPrice),
      initialPaymentAmount: completeNewAgreement.initialPaymentAmount ? Number(completeNewAgreement.initialPaymentAmount) : null,
    };

    return { success: true, agreement: serializableAgreement };
  } catch (error: any) {
    console.error("Error creating agreement:", error);
    let errorMessage = "Failed to create agreement.";
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') { 
        errorMessage = "Failed to create agreement. A similar agreement might already exist or related data conflict (e.g. space already linked).";
      } else if (error.code === 'P2025') {
        errorMessage = "Failed to create agreement. Tenant, Space, or Template not found.";
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
}
