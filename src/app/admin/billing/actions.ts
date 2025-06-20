
"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma, type Agreement as AgreementPrismaOriginal, type Bill as BillPrisma, type Space as SpacePrismaOriginal, type Building as BuildingPrismaOriginal, type BuildingMonthlyUtilities as BuildingMonthlyUtilitiesPrisma, type UtilityBreakdownItem as UtilityBreakdownItemPrismaOriginal, type PenaltyTier as PenaltyTierPrismaOriginal, type Tenant as TenantPrismaOriginal } from '@prisma/client';
import { addMonths, getMonth, getYear, startOfDay, differenceInDays, isBefore, isSameDay, setMonth, setYear, parseISO, format } from 'date-fns';

// Define a simpler type for utility items if they are stored as JSON
interface ParsedUtilityItem {
  id?: string; // Optional, if JSON contains it
  name: string;
  amount: number;
}

// Adjusted types to use ParsedUtilityItem for bill.utilityBreakdown
export interface BillingPageData {
  agreements: (AgreementPrismaOriginal & { tenant: TenantPrismaOriginal; space: SpacePrismaOriginal & { building: BuildingPrismaOriginal & { penaltyPolicyTiers: PenaltyTierPrismaOriginal[]; spaces: SpacePrismaOriginal[] } } })[];
  spaces: (SpacePrismaOriginal & { building: BuildingPrismaOriginal & { penaltyPolicyTiers: PenaltyTierPrismaOriginal[]; spaces: SpacePrismaOriginal[] } })[];
  buildings: (BuildingPrismaOriginal & { penaltyPolicyTiers: PenaltyTierPrismaOriginal[]; spaces: SpacePrismaOriginal[] })[];
  bills: (Omit<BillPrisma, 'utilityBreakdown'> & { 
    utilityBreakdown: ParsedUtilityItem[]; 
    agreement: AgreementPrismaOriginal & { 
      tenant: TenantPrismaOriginal; 
      space: SpacePrismaOriginal & { 
        building: BuildingPrismaOriginal & { penaltyPolicyTiers: PenaltyTierPrismaOriginal[]; spaces: SpacePrismaOriginal[] } 
      } 
    } 
  })[]; 
  buildingMonthlyUtilities: (BuildingMonthlyUtilitiesPrisma & { utilities: Prisma.BuildingUtilityItemGetPayload<{}>[] })[];
}

export async function getBillingPageDataAction(): Promise<BillingPageData> {
  const today = new Date();
  const currentMonth = getMonth(today);
  const currentYear = getYear(today);
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const [agreementsData, spacesData, buildingsData, billsDataRaw, buildingMonthlyUtilitiesData] = await Promise.all([
    databaseService.getAllAgreements({
      include: {
        tenant: true,
        space: {
          include: {
            building: { include: { penaltyPolicyTiers: true, spaces: true } } 
          }
        }
      },
      orderBy: { tenant: { name: 'asc' } }
    }),
    databaseService.getAllSpaces({
      include: {
        building: { include: { penaltyPolicyTiers: true, spaces: true } } 
      }
    }),
    databaseService.getAllBuildings({ include: { penaltyPolicyTiers: true, spaces: true } }), 
    databaseService.getAllBills({ 
      include: {
        agreement: {
          include: {
            tenant: true,
            space: {
              include: {
                building: { include: { penaltyPolicyTiers: true, spaces: true } } 
              }
            }
          }
        }
        // utilityBreakdown is NOT included here if it's a scalar JSON field (Bill model limitation)
      },
      orderBy: { billDate: 'desc' }
    }),
    databaseService.getAllBuildingMonthlyUtilities({
      where: {
        OR: [
          { year: currentYear, month: currentMonth },
          { year: prevMonthYear, month: prevMonth },
        ]
      },
      include: { utilities: true }
    })
  ]);

  const agreements = agreementsData as BillingPageData['agreements'];
  const spaces = spacesData as BillingPageData['spaces'];
  const buildings = buildingsData as BillingPageData['buildings'];
  
  const bills = billsDataRaw.map(billRaw => {
    let parsedUtilityBreakdown: ParsedUtilityItem[] = [];
    const rawUtilityData = (billRaw as any).utilityBreakdown; 

    if (typeof rawUtilityData === 'string') {
      try {
        const jsonData = JSON.parse(rawUtilityData);
        if (Array.isArray(jsonData)) {
          parsedUtilityBreakdown = jsonData
            .filter(item => typeof item.name === 'string' && typeof item.amount === 'number')
            .map(item => ({ 
              name: item.name, 
              amount: item.amount,
              id: typeof item.id === 'string' ? item.id : undefined 
            }));
        } else {
          console.warn(`Parsed utilityBreakdown for bill ${billRaw.id} is not an array:`, jsonData);
        }
      } catch (e) {
        console.error(`Failed to parse utilityBreakdown JSON for bill ${billRaw.id}:`, e, rawUtilityData);
      }
    } else if (Array.isArray(rawUtilityData)) {
       parsedUtilityBreakdown = rawUtilityData
            .filter(item => typeof item.name === 'string' && typeof item.amount === 'number')
            .map(item => ({ 
              name: item.name, 
              amount: item.amount,
              id: typeof item.id === 'string' ? item.id : undefined
            }));
    }
    
    const agreementForBill = billRaw.agreement as unknown as BillingPageData['bills'][number]['agreement'];

    return {
      ...billRaw,
      agreement: agreementForBill, 
      utilityBreakdown: parsedUtilityBreakdown,
    };
  }) as BillingPageData['bills'];


  const buildingMonthlyUtilities = buildingMonthlyUtilitiesData as BillingPageData['buildingMonthlyUtilities'];

  return { agreements, spaces, buildings, bills, buildingMonthlyUtilities };
}

function calculateIndividualPenalty(
  billAmount: number, 
  daysOverdue: number,
  building: BuildingPrismaOriginal & { penaltyPolicyTiers: Prisma.PenaltyTierGetPayload<{}>[]; spaces: SpacePrismaOriginal[] }, // Added spaces
  space: SpacePrismaOriginal
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

    const agreement = await databaseService.getAgreementById(agreementId, { 
      space: { 
        include: { 
          building: { 
            include: { 
              penaltyPolicyTiers: true, 
              spaces: true 
            } 
          } 
        } 
      }, 
      tenant: true 
    });
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
    const utilityItemsForJson: {name: string; amount: number}[] = []; 
    let totalUtilityCostForBill = 0;

    const billYear = getYear(targetBillDate);
    const billMonth = getMonth(targetBillDate);

    const monthlyBuildingUtilityData = await databaseService.getBuildingMonthlyUtilitiesByBuildingMonthYear(
      agreement.space.building.id,
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
          utilityItemsForJson.push({ name: utilItem.name, amount: roundedCost });
          totalUtilityCostForBill += roundedCost;
        }
      });
    }

    let initialPenalty = 0;
    const dueDate = targetBillDate; 
    if (isBefore(dueDate, today)) { 
        const daysOverdue = differenceInDays(today, dueDate); 
        initialPenalty = calculateIndividualPenalty(rentAmount, daysOverdue, agreement.space.building, agreement.space);
    }

    const totalAmount = rentAmount + totalUtilityCostForBill + initialPenalty;
    
    const utilityBreakdownJson = utilityItemsForJson.length > 0 ? JSON.stringify(utilityItemsForJson) : Prisma.JsonNull;

    const billCreateInput: Prisma.BillCreateInput = {
      agreement: { connect: { id: agreement.id } },
      tenant: { connect: { id: agreement.tenantId } },
      billDate: targetBillDate,
      dueDate: targetBillDate, 
      rentAmount,
      utilityBreakdown: utilityBreakdownJson, 
      penaltyAmount: initialPenalty > 0 ? initialPenalty : undefined,
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      status: isBefore(targetBillDate, today) && initialPenalty > 0 ? 'Overdue' : 'Pending',
    };

    const newBill = await databaseService.createBill(billCreateInput);
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
    adminProofUrl?: string | null;
  },
  actionType: 'recordPayment' | 'confirmVerification' | 'rejectVerification'
) {
  try {
    const bill = await databaseService.getBillById(billId, { 
      agreement: {                                       
        include: {                                       
          tenant: true,
          space: {                                       
            include: {                                   
              building: {                                
                include: {                               
                  penaltyPolicyTiers: true,
                  spaces: true 
                }
              }
            }
          }
        }
      }
    });
    if (!bill) throw new Error("Bill not found.");
    if (!bill.agreement?.space?.building) throw new Error("Building details for bill not found for penalty check.");

    let utilityBreakdownItems: ParsedUtilityItem[] = [];
    if (typeof (bill as any).utilityBreakdown === 'string') {
        try {
            const parsed = JSON.parse((bill as any).utilityBreakdown);
            if (Array.isArray(parsed)) {
                utilityBreakdownItems = parsed.filter(item => typeof item.name === 'string' && typeof item.amount === 'number')
                                             .map(item => ({ name: item.name, amount: item.amount, id: item.id }));
            }
        } catch (e) {
            console.error("Error parsing utilityBreakdown for penalty calculation in recordPayment:", e);
        }
    }


    const today = startOfDay(new Date());
    let newStatus: Prisma.BillStatus = bill.status;
    let finalPaymentDate = paymentData.paymentDate ? parseISO(paymentData.paymentDate) : new Date();

    let currentPenalty = bill.penaltyAmount || 0;
    if ( (isBefore(parseISO(bill.dueDate.toISOString()), finalPaymentDate) || bill.status === 'Overdue') && actionType !== 'rejectVerification') {
        const daysOverdue = differenceInDays(finalPaymentDate, parseISO(bill.dueDate.toISOString()));
        if (daysOverdue > 0) {
             currentPenalty = calculateIndividualPenalty(bill.rentAmount, daysOverdue, bill.agreement.space.building, bill.agreement.space);
        } else { 
            currentPenalty = 0;
        }
    }

    const billUpdateData: Prisma.BillUpdateInput = {
      paymentMethod: paymentData.paymentMethod,
      paymentReference: paymentData.paymentReference,
      bankOrWalletName: (paymentData.paymentMethod === "Bank Transfer" || paymentData.paymentMethod === "Wallet") ? paymentData.bankOrWalletName : null,
      adminVerificationNotes: paymentData.adminVerificationNotes,
      penaltyAmount: currentPenalty > 0 ? currentPenalty : null,
    };

    const baseAmount = bill.rentAmount + (utilityBreakdownItems.reduce((sum, util) => sum + util.amount, 0) || 0);
    billUpdateData.totalAmount = parseFloat((baseAmount + (currentPenalty > 0 ? currentPenalty : 0)).toFixed(2));


    if (actionType === 'recordPayment' || actionType === 'confirmVerification') {
      newStatus = 'Paid';
      billUpdateData.paymentDate = finalPaymentDate;
      billUpdateData.adminVerifiedPayment = true;
      if (paymentData.adminProofUrl) {
        billUpdateData.paymentProofUrl = paymentData.adminProofUrl;
      }
    } else if (actionType === 'rejectVerification') {
      newStatus = isBefore(parseISO(bill.dueDate.toISOString()), today) ? 'Overdue' : 'Pending';
      billUpdateData.adminVerifiedPayment = false;
      billUpdateData.paymentDate = null; 
      billUpdateData.paymentMethod = null;
      billUpdateData.paymentReference = null;
      billUpdateData.bankOrWalletName = null;
      
      const rejectedBaseAmount = bill.rentAmount + (utilityBreakdownItems.reduce((sum, util) => sum + util.amount, 0) || 0);
      let rejectedPenalty = 0;
      if (newStatus === 'Overdue') {
          const daysOverdueNow = differenceInDays(today, parseISO(bill.dueDate.toISOString()));
          if (daysOverdueNow > 0) {
            rejectedPenalty = calculateIndividualPenalty(bill.rentAmount, daysOverdueNow, bill.agreement.space.building, bill.agreement.space);
            billUpdateData.penaltyAmount = rejectedPenalty > 0 ? rejectedPenalty : null;
          } else {
             billUpdateData.penaltyAmount = null; 
          }
      } else {
          billUpdateData.penaltyAmount = null; 
      }
      billUpdateData.totalAmount = parseFloat((rejectedBaseAmount + rejectedPenalty).toFixed(2));

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
    } catch (error: any)
     {
        console.error("Error deleting bill:", error);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return { success: false, error: "Bill not found." };
        }
        return { success: false, error: error.message || "Failed to delete bill." };
    }
}

    
    
