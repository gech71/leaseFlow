
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
  
  // Initial Payment details from form
  initialPaymentMethod: string;
  initialPaymentReference?: string | null;
  initialPaymentBankOrWalletName?: string | null;
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
          initialPaymentMethod: input.initialPaymentMethod,
          initialPaymentReference: input.initialPaymentReference,
          initialPaymentBankOrWalletName: (input.initialPaymentMethod === "Bank Transfer" || input.initialPaymentMethod === "Wallet") ? input.initialPaymentBankOrWalletName : null,
          initialPaymentDate: startDateObj,

          tenant: { connect: { id: input.tenantId } },
          space: { connect: { id: input.spaceId } },
        }
      });

      // 2. Create a "Bill" for the initial payment, marked as Paid
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
            status: 'Paid',
            paymentDate: startDateObj,
            paymentMethod: input.initialPaymentMethod,
            paymentReference: input.initialPaymentReference,
            bankOrWalletName: (input.initialPaymentMethod === "Bank Transfer" || input.initialPaymentMethod === "Wallet") ? input.initialPaymentBankOrWalletName : null,
            adminVerifiedPayment: true,
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
    return { success: true, agreement: newAgreement };
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

        // Check if there are any monthly bills (not the initial payment record).
        // A monthly bill is any bill whose date is not the same as the agreement's start date.
        const hasSubsequentBills = agreement.bills.some(
            bill => !isSameDay(bill.billDate, agreement.startDate)
        );

        if (hasSubsequentBills) {
            return { success: false, error: "Cannot delete agreement with associated monthly bills. Please resolve or delete these bills first." };
        }

        // Proceed with deletion in a transaction.
        await prisma.$transaction(async (tx) => {
            // 1. Delete all associated bills (which at this point can only be initial payment bills).
            await tx.bill.deleteMany({
                where: { agreementId: agreement.id }
            });

            // 2. Vacate the space if this agreement made it occupied.
            if (agreement.space && agreement.space.tenantId === agreement.tenantId) {
                // Check if there are other agreements for this space and tenant before vacating.
                const otherAgreements = await tx.agreement.findMany({
                    where: {
                        spaceId: agreement.spaceId,
                        tenantId: agreement.tenantId,
                        id: { not: agreementId },
                    }
                });
                if (otherAgreements.length === 0) {
                    await tx.space.update({
                        where: { id: agreement.spaceId },
                        data: {
                            isOccupied: false,
                            tenant: { disconnect: true }
                        }
                    });
                    await tx.tenant.update({
                        where: { id: agreement.tenantId },
                        data: {
                            rentedSpace: { disconnect: true }
                        }
                    });
                }
            }
            
            // 3. Delete the agreement itself.
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


export interface RenewAgreementData {
    startDate: string; // ISO String from client
    paymentTermMonths: number;
    monthlyRentalPrice: number;
    initialPaymentMonths: number;
    
    // Initial Payment details from form
    initialPaymentMethod: string;
    initialPaymentReference?: string | null;
    initialPaymentBankOrWalletName?: string | null;
}

export async function updateAgreementAction(agreementId: string, data: Partial<RenewAgreementData>) {
    try {
        const agreement = await databaseService.getAgreementById(agreementId);
        if (!agreement) {
            return { success: false, error: "Agreement not found." };
        }

        const updatedAgreement = await prisma.$transaction(async (tx) => {
            const startDateObj = data.startDate ? parseISO(data.startDate) : agreement.startDate;
            const termMonths = data.paymentTermMonths ?? agreement.paymentTermMonths;
            const initialPaymentMonths = data.initialPaymentMonths ?? 0;
            const monthlyRent = data.monthlyRentalPrice ?? agreement.monthlyRentalPrice;

            const nextPaymentDueDate = addMonths(startDateObj, initialPaymentMonths);

            // Update the agreement itself
            const renewedAgreement = await tx.agreement.update({
                where: { id: agreementId },
                data: {
                    startDate: data.startDate ? parseISO(data.startDate) : undefined,
                    paymentTermMonths: data.paymentTermMonths,
                    monthlyRentalPrice: data.monthlyRentalPrice,
                    initialPaymentMonths: data.initialPaymentMonths,
                    nextPaymentDueDate: nextPaymentDueDate,
                },
            });

            // If there's an initial payment for the renewal, create a new bill for it
            if (initialPaymentMonths > 0 && data.initialPaymentMethod) {
                const initialPaymentAmount = monthlyRent * initialPaymentMonths;
                await tx.bill.create({
                    data: {
                        agreementId: agreementId,
                        tenantId: agreement.tenantId,
                        billDate: startDateObj,
                        dueDate: startDateObj,
                        rentAmount: initialPaymentAmount,
                        utilityBreakdown: Prisma.JsonNull,
                        penaltyAmount: 0,
                        totalAmount: initialPaymentAmount,
                        status: 'Paid',
                        paymentDate: startDateObj, // Assume payment is made on the renewal start date
                        paymentMethod: data.initialPaymentMethod,
                        paymentReference: data.initialPaymentReference,
                        bankOrWalletName: (data.initialPaymentMethod === "Bank Transfer" || data.initialPaymentMethod === "Wallet") ? data.initialPaymentBankOrWalletName : null,
                        adminVerifiedPayment: true,
                        tenantPaymentNotes: "Initial payment for agreement renewal."
                    }
                });
            }

            return renewedAgreement;
        });

        revalidatePath('/admin/agreements');
        revalidatePath(`/admin/agreements/${agreementId}`);
        revalidatePath('/admin/billing');

        return { success: true, agreement: updatedAgreement };

    } catch (error: any) {
        console.error("Error renewing agreement:", error);
        return { success: false, error: error.message || "Failed to renew agreement." };
    }
}
