
"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma, type Agreement } from '@prisma/client';
import { addMonths, parseISO, isSameDay } from 'date-fns';
import { prisma } from '@/lib/prisma';

export interface CreateFullAgreementData {
  tenantId: string;
  spaceId: string;
  
  agreementText: string;
  startDate: string;
  monthlyRentalPrice: number;
  paymentTermMonths: number;
  initialPaymentMonths: number;
  additionalTerms?: string | null;
}

export async function createFullAgreementAction(input: CreateFullAgreementData) {
  try {
    const startDateObj = parseISO(input.startDate);
    const nextPaymentDueDateObj = addMonths(startDateObj, 1);
    const initialPaymentAmount = input.monthlyRentalPrice * input.initialPaymentMonths;

    const newAgreementId = await prisma.$transaction(async (tx) => {
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
        }
      });

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
            status: 'Pending',
            paymentDate: null,
            paymentMethod: null,
            paymentReference: null,
            adminVerifiedPayment: false, 
          }
        });
      }

      await tx.space.update({
        where: { id: input.spaceId },
        data: {
          isOccupied: true,
          tenant: { connect: { id: input.tenantId } },
        },
      });

      await tx.tenant.update({
        where: { id: input.tenantId },
        data: {
          rentedSpace: { connect: { id: input.spaceId } },
        },
      });
      
      return agreement.id;
    });

    const completeNewAgreement = await databaseService.getAgreementById(newAgreementId, {
      tenant: true,
      space: true
    });

    if (!completeNewAgreement) {
        throw new Error("Failed to re-fetch the newly created agreement.");
    }

    revalidatePath('/admin/agreements');
    revalidatePath('/admin/spaces');
    revalidatePath('/admin/tenants');
    revalidatePath('/admin/billing');
    
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
        errorMessage = "Failed to create agreement. Tenant or Space not found.";
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
}
