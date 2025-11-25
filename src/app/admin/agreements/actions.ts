
"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma, type Agreement, AgreementStatus } from '@prisma/client';
import { addMonths, parseISO, isSameDay } from 'date-fns';
import { prisma } from '@/lib/prisma';
import { getUserAndPermissions } from '@/lib/actions/server-helpers';

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
          status: 'Active', // Set initial status to Active
          
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

export async function cancelAgreementAction(agreementId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { isSuperAdmin, permissions } = await getUserAndPermissions();
        if (!isSuperAdmin && !permissions.has('agreement:edit')) { // Using 'edit' as a proxy for cancellation
            return { success: false, error: "You do not have permission to cancel agreements." };
        }

        const agreement = await databaseService.getAgreementById(agreementId);
        if (!agreement) {
            return { success: false, error: "Agreement not found." };
        }

        if (agreement.status === 'Canceled') {
            return { success: false, error: "This agreement has already been canceled." };
        }

        await prisma.$transaction(async (tx) => {
            // 1. Update the agreement status to 'Canceled'
            await tx.agreement.update({
                where: { id: agreementId },
                data: { status: 'Canceled' },
            });

            // 2. Free up the space
            if (agreement.spaceId) {
                await tx.space.update({
                    where: { id: agreement.spaceId },
                    data: { isOccupied: false, tenantId: null },
                });
            }

            // 3. Disconnect tenant from the space
            if (agreement.tenantId) {
                await tx.tenant.update({
                    where: { id: agreement.tenantId },
                    data: { rentedSpaceId: null },
                });
            }

            // 4. Delete all non-paid bills for this agreement
            await tx.bill.deleteMany({
                where: {
                    agreementId: agreementId,
                    status: { not: 'Paid' },
                },
            });
        });

        revalidatePath('/admin/agreements');
        revalidatePath('/admin/spaces');
        revalidatePath('/admin/tenants');
        revalidatePath('/admin/billing');
        revalidatePath('/admin/dashboard');

        return { success: true };
    } catch (error: any) {
        console.error("Error cancelling agreement:", error);
        return { success: false, error: error.message || "Failed to cancel agreement." };
    }
}
