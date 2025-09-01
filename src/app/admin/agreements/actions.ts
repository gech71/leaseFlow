
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

    const newAgreement = await prisma.$transaction(async (tx) => {
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
      
      return agreement;
    });

    revalidatePath('/admin/agreements');
    revalidatePath('/admin/spaces'); // Space occupancy changed
    revalidatePath('/admin/tenants'); // Tenant's rentedSpace changed
    revalidatePath('/admin/billing'); // Invalidate billing page data
    
    // Convert Decimal fields to numbers before returning
    const serializableAgreement = {
      ...newAgreement,
      monthlyRentalPrice: Number(newAgreement.monthlyRentalPrice),
      initialPaymentAmount: newAgreement.initialPaymentAmount ? Number(newAgreement.initialPaymentAmount) : null,
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

export async function deleteAgreementAction(agreementId: string) {
    try {
        const agreement = await databaseService.getAgreementById(agreementId, {
            bills: true,
            space: true
        });
        if (!agreement) {
            return { success: false, error: "Agreement not found." };
        }

        const hasSubsequentBills = agreement.bills.some(
            bill => !isSameDay(bill.billDate, agreement.startDate)
        );

        if (hasSubsequentBills) {
            return { success: false, error: "Cannot delete agreement with associated monthly bills. Please resolve or delete these bills first." };
        }

        await prisma.$transaction(async (tx) => {
            // Delete all associated bills (which at this point can only be initial payment bills).
            await tx.bill.deleteMany({
                where: { agreementId: agreement.id }
            });

            // If the space is linked to this agreement's tenant, disconnect them
            if (agreement.space && agreement.space.tenantId === agreement.tenantId) {
                // Check if this is the ONLY agreement for this tenant-space combo.
                const otherAgreementsForPair = await tx.agreement.count({
                    where: {
                        spaceId: agreement.spaceId,
                        tenantId: agreement.tenantId,
                        id: { not: agreementId },
                    }
                });

                // Only vacate if no other active agreements link this tenant and space.
                if (otherAgreementsForPair === 0) {
                    await tx.space.update({
                        where: { id: agreement.spaceId },
                        data: {
                            isOccupied: false,
                            tenantId: null // Disconnect by setting foreign key to null
                        }
                    });
                    
                    await tx.tenant.update({
                        where: { id: agreement.tenantId },
                        data: {
                            rentedSpaceId: null // Disconnect by setting foreign key to null
                        }
                    });
                }
            }
            
            // Finally, delete the agreement itself.
            await tx.agreement.delete({
                where: { id: agreementId }
            });
        });

        revalidatePath('/admin/agreements');
        revalidatePath('/admin/spaces');
        revalidatePath('/admin/tenants');
        revalidatePath('/admin/billing');
        return { success: true };
    } catch (error: any) {
        console.error("Error deleting agreement:", error);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return { success: false, error: "Failed to delete agreement. Record not found." };
        }
        return { success: false, error: error.message || "Failed to delete agreement." };
    }
}
