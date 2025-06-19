
"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import type { Prisma, Agreement, Bill, Space, Building, BuildingMonthlyUtilities, UtilityBreakdownItem as PrismaUtilityBreakdownItem } from '@prisma/client';
import { addMonths, getMonth, getYear, startOfDay, differenceInDays, isBefore, isSameDay, setMonth, setYear, parseISO } from 'date-fns';

export interface BillingPageData {
  agreements: (Agreement & { tenant: Prisma.TenantGetPayload<{}>; space: Prisma.SpaceGetPayload<{}> })[];
  spaces: Space[];
  buildings: (Building & { penaltyPolicyTiers: Prisma.PenaltyTierGetPayload<{}>[] })[];
  bills: (Bill & { agreement: Agreement & { tenant: Prisma.TenantGetPayload<{}>; space: Space } })[];
  buildingMonthlyUtilities: (BuildingMonthlyUtilities & { utilities: Prisma.BuildingUtilityItemGetPayload<{}>[] })[];
}

export async function getBillingPageDataAction(): Promise<BillingPageData> {
  const today = new Date();
  const currentMonth = getMonth(today);
  const currentYear = getYear(today);
  // Fetch utilities for current and previous month as bills might span these
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const [agreements, spaces, buildings, bills, buildingMonthlyUtilities] = await Promise.all([
    databaseService.getAllAgreements({ include: { tenant: true, space: true }, orderBy: { tenant: { name: 'asc' } } }),
    databaseService.getAllSpaces({ include: { building: true } }), // building needed for penalty policy context
    databaseService.getAllBuildings({ include: { penaltyPolicyTiers: true } }),
    databaseService.getAllBills({ include: { agreement: { include: { tenant: true, space: true } }, utilityBreakdown: true }, orderBy: { billDate: 'desc' } }),
    databaseService.getAllBuildingMonthlyUtilities({
      where: {
        OR: [
          { year: currentYear, month: currentMonth },
          { year: prevMonthYear, month: prevMonth },
          // Add more months if bill generation can go further back/forward
        ]
      },
      include: { utilities: true }
    })
  ]);
  return { agreements, spaces, buildings, bills, buildingMonthlyUtilities };
}

function calculateIndividualPenalty(
  billAmount: number, // typically rentAmount
  daysOverdue: number,
  building: Building & { penaltyPolicyTiers: Prisma.PenaltyTierGetPayload<{}>[] },
  space: Space
): number {
  if (daysOverdue <= 0 || !building.penaltyPolicyTiers || building.penaltyPolicyTiers.length === 0) {
    return 0;
  }

  let applicableTiers: Prisma.PenaltyTierGetPayload<{}>[] = [];
  const spaceSpecificTiers = building.penaltyPolicyTiers.filter(
    t => t.scope === 'SpecificSpaces' && t.applicableSpaceIdNames?.includes(space.spaceIdName)
  );
  if (spaceSpecificTiers.length > 0) {
    applicableTiers = spaceSpecificTiers;
  } else {
    const floorSpecificTiers = building.penaltyPolicyTiers.filter(
      t => t.scope === 'Floor' && t.applicableFloor === space.floor
    );
    if (floorSpecificTiers.length > 0) {
      applicableTiers = floorSpecificTiers;
    } else {
      applicableTiers = building.penaltyPolicyTiers.filter(t => t.scope === 'Building');
    }
  }

  if (applicableTiers.length === 0) return 0;
  const sortedTiers = [...applicableTiers].sort((a, b) => a.fromDay - b.fromDay);
  let calculatedPenalty = 0;

  for (const tier of sortedTiers) {
    if (daysOverdue >= tier.fromDay && (tier.toDay === null || daysOverdue <= tier.toDay)) {
      if (tier.feeType === 'Fixed') {
        calculatedPenalty = tier.feeValue;
      } else if (tier.feeType === 'Percentage') {
        calculatedPenalty = billAmount * (tier.feeValue / 100);
      }
      break;
    }
  }
  return parseFloat(calculatedPenalty.toFixed(2));
}


export async function generateBillAndUpdateAgreementAction(agreementId: string, targetBillDateStr: string) {
  try {
    const targetBillDate = startOfDay(parseISO(targetBillDateStr));
    const today = startOfDay(new Date());

    const agreement = await databaseService.getAgreementById(agreementId, { include: { space: { include: { building: { include: { penaltyPolicyTiers: true } } } }, tenant: true } });
    if (!agreement) throw new Error("Agreement not found.");
    if (!agreement.space) throw new Error("Space details for agreement not found.");
    if (!agreement.space.building) throw new Error("Building details for space not found.");

    const existingBill = await databaseService.getAllBills({
        where: {
            agreementId: agreement.id,
            billDate: targetBillDate,
            OR: [{status: 'Pending'}, {status: 'Overdue'}, {status: 'PendingVerification'}]
        }
    });
    if (existingBill.length > 0) {
        return { success: false, error: `A bill for ${format(targetBillDate, 'PP')} for ${agreement.tenant.name} already exists (Status: ${existingBill[0].status}).`};
    }

    const rentAmount = agreement.monthlyRentalPrice;
    const utilityBreakdownItemsCreate: Prisma.UtilityBreakdownItemCreateManyWithoutBillInput[] = [];
    let totalUtilityCostForBill = 0;

    const billYear = getYear(targetBillDate);
    const billMonth = getMonth(targetBillDate);

    const monthlyBuildingUtilityData = await databaseService.getBuildingMonthlyUtilitiesByBuildingMonthYear(
      agreement.space.building.id, // Use buildingId here
      billMonth,
      billYear,
      { include: { utilities: true } }
    );
    
    if (monthlyBuildingUtilityData?.utilities.length) {
      monthlyBuildingUtilityData.utilities.forEach(utilItem => {
        let costForThisUtility = 0;
        switch (utilItem.appliesToScope) {
          case 'Building': costForThisUtility = utilItem.totalCost * agreement.space.utilityProrationShare; break;
          case 'Floor':
            if (utilItem.applicableFloor && agreement.space.floor === utilItem.applicableFloor) {
              // This is simplified; a more accurate proration would need count of spaces on floor
              const spacesOnFloor = agreement.space.building.spaces?.filter(s => s.floor === utilItem.applicableFloor).length || 1;
              costForThisUtility = spacesOnFloor > 0 ? utilItem.totalCost / spacesOnFloor : 0;
            }
            break;
          case 'SpecificSpaces':
            if (utilItem.applicableSpaceIdNames?.includes(agreement.space.spaceIdName)) {
              costForThisUtility = utilItem.applicableSpaceIdNames.length > 0 ? utilItem.totalCost / utilItem.applicableSpaceIdNames.length : 0;
            }
            break;
        }
        if (costForThisUtility > 0) {
          const roundedCost = parseFloat(costForThisUtility.toFixed(2));
          utilityBreakdownItemsCreate.push({ name: utilItem.name, amount: roundedCost } as unknown as Prisma.UtilityBreakdownItemCreateManyWithoutBillInput); // Cast needed for createMany structure
          totalUtilityCostForBill += roundedCost;
        }
      });
    }

    let initialPenalty = 0;
    const dueDate = targetBillDate; // For new bills, dueDate is same as billDate, penalty calculation is dynamic
    if (isBefore(dueDate, today)) {
        const daysOverdue = differenceInDays(today, dueDate);
        initialPenalty = calculateIndividualPenalty(rentAmount, daysOverdue, agreement.space.building, agreement.space);
    }

    const totalAmount = rentAmount + totalUtilityCostForBill + initialPenalty;

    const billCreateInput: Prisma.BillCreateInput = {
      agreement: { connect: { id: agreement.id } },
      tenant: { connect: { id: agreement.tenantId } },
      billDate: targetBillDate,
      dueDate: targetBillDate, // Due date for new bills is often the bill date or slightly after.
      rentAmount,
      utilityBreakdown: { create: utilityBreakdownItemsCreate as Prisma.UtilityBreakdownItemCreateWithoutBillInput[] },
      penaltyAmount: initialPenalty > 0 ? initialPenalty : undefined,
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      status: isBefore(targetBillDate, today) && initialPenalty > 0 ? 'Overdue' : 'Pending',
    };

    const newBill = await databaseService.createBill(billCreateInput);
    // Update agreement's next payment due date
    await databaseService.updateAgreement(agreement.id, { nextPaymentDueDate: addMonths(targetBillDate, 1) });
    
    revalidatePath('/admin/billing');
    return { success: true, bill: newBill };
  } catch (error: any) {
    console.error("Error generating bill:", error);
    return { success: false, error: error.message || "Failed to generate bill." };
  }
}

export async function recordPaymentOrVerificationAction(
  billId: string,
  paymentData: {
    paymentDate: string; // ISO string
    paymentMethod: string;
    paymentReference?: string | null;
    bankOrWalletName?: string | null;
    adminVerificationNotes?: string | null;
    adminProofUrl?: string | null; // If admin uploads a new proof
  },
  actionType: 'recordPayment' | 'confirmVerification' | 'rejectVerification'
) {
  try {
    const bill = await databaseService.getBillById(billId, { include: { agreement: { include: { space: { include: { building: {include: {penaltyPolicyTiers: true}}}}}}}} });
    if (!bill) throw new Error("Bill not found.");
    if (!bill.agreement?.space?.building) throw new Error("Building details for bill not found for penalty check.");

    const today = startOfDay(new Date());
    let newStatus: Prisma.BillStatus = bill.status;
    let finalPaymentDate = paymentData.paymentDate ? parseISO(paymentData.paymentDate) : new Date();
    
    // Recalculate penalty if overdue and not already paid/verified
    let currentPenalty = bill.penaltyAmount || 0;
    if ((bill.status === 'Overdue' || (bill.status === 'Pending' && isBefore(parseISO(bill.dueDate.toISOString()), today))) && actionType !== 'rejectVerification') {
        const daysOverdue = differenceInDays(finalPaymentDate, parseISO(bill.dueDate.toISOString())); // Use payment date for overdue calculation
        if (daysOverdue > 0) {
             currentPenalty = calculateIndividualPenalty(bill.rentAmount, daysOverdue, bill.agreement.space.building, bill.agreement.space);
        } else {
            currentPenalty = 0; // If paid on or before due date, no penalty
        }
    }


    const billUpdateData: Prisma.BillUpdateInput = {
      paymentMethod: paymentData.paymentMethod,
      paymentReference: paymentData.paymentReference,
      bankOrWalletName: (paymentData.paymentMethod === "Bank Transfer" || paymentData.paymentMethod === "Wallet") ? paymentData.bankOrWalletName : null,
      adminVerificationNotes: paymentData.adminVerificationNotes,
      penaltyAmount: currentPenalty > 0 ? currentPenalty : null,
      // totalAmount will be updated based on rent, utilities, and new penalty
    };
    
    const baseAmount = bill.rentAmount + bill.utilityBreakdown.reduce((sum, util) => sum + util.amount, 0);
    billUpdateData.totalAmount = parseFloat((baseAmount + (currentPenalty > 0 ? currentPenalty : 0)).toFixed(2));


    if (actionType === 'recordPayment' || actionType === 'confirmVerification') {
      newStatus = 'Paid';
      billUpdateData.paymentDate = finalPaymentDate;
      billUpdateData.adminVerifiedPayment = true;
      if (paymentData.adminProofUrl) {
        billUpdateData.paymentProofUrl = paymentData.adminProofUrl; // Overwrite if admin provides new
      }
    } else if (actionType === 'rejectVerification') {
      newStatus = isBefore(parseISO(bill.dueDate.toISOString()), today) ? 'Overdue' : 'Pending';
      billUpdateData.adminVerifiedPayment = false;
      // Clear payment details if rejecting
      billUpdateData.paymentDate = null;
      billUpdateData.paymentMethod = null;
      billUpdateData.paymentReference = null;
      billUpdateData.bankOrWalletName = null;
      // Penalty logic for rejection: if it was overdue, penalty calculated above remains. If pending, it's 0.
      if (newStatus === 'Pending') billUpdateData.penaltyAmount = null;
    }

    billUpdateData.status = newStatus;
    const updatedBill = await databaseService.updateBill(billId, billUpdateData);

    revalidatePath('/admin/billing');
    return { success: true, bill: updatedBill };
  } catch (error: any) {
    console.error(`Error in ${actionType}:`, error);
    return { success: false, error: error.message || `Failed to ${actionType.replace('Verification', ' verification').toLowerCase()}.` };
  }
}

export async function deleteBillAction(billId: string) {
    try {
        await databaseService.deleteBill(billId);
        revalidatePath('/admin/billing');
        return { success: true };
    } catch (error: any) {
        console.error("Error deleting bill:", error);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return { success: false, error: "Bill not found." };
        }
        return { success: false, error: error.message || "Failed to delete bill." };
    }
}
