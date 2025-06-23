
"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma, type Agreement as AgreementPrismaOriginal, type Bill as BillPrismaOriginal, type Space as SpacePrismaOriginal, type Building as BuildingPrismaOriginal, type BuildingMonthlyUtilities as BuildingMonthlyUtilitiesPrisma, type UtilityBreakdownItem as UtilityBreakdownItemPrismaOriginal, type PenaltyTier as PenaltyTierPrismaOriginal, type Tenant as TenantPrismaOriginal } from '@prisma/client';
import { addMonths, getMonth, getYear, startOfDay, differenceInDays, isBefore, setMonth, setYear, parseISO, format, addDays, subMonths } from 'date-fns';
import type { SerializedBillingPageData, SerializedParsedUtilityItem } from './page'; // Import serialized types from page.tsx for return type

const EPOCH_ISO_STRING = new Date(0).toISOString();

// Original data structure from DB (BillingPageData definition removed as action now returns SerializedBillingPageData)

export async function getBillingPageDataAction(): Promise<SerializedBillingPageData> {
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

  // Serialization logic moved here
  const serializedAgreements = agreementsData.map(ag => ({
    ...(ag as AgreementPrismaOriginal & { tenant: TenantPrismaOriginal; space: SpacePrismaOriginal & { building: BuildingPrismaOriginal & { penaltyPolicyTiers: PenaltyTierPrismaOriginal[]; spaces: SpacePrismaOriginal[] } } }),
    createdAt: ag.createdAt ? ag.createdAt.toISOString() : EPOCH_ISO_STRING,
    updatedAt: ag.updatedAt ? ag.updatedAt.toISOString() : (ag.createdAt ? ag.createdAt.toISOString() : EPOCH_ISO_STRING),
    startDate: ag.startDate ? ag.startDate.toISOString() : EPOCH_ISO_STRING,
    nextPaymentDueDate: ag.nextPaymentDueDate ? ag.nextPaymentDueDate.toISOString() : EPOCH_ISO_STRING,
    initialPaymentDate: ag.initialPaymentDate?.toISOString() || null,
    endDate: ag.endDate?.toISOString() || null,
    tenant: ag.tenant ? {
      ...(ag.tenant as TenantPrismaOriginal),
      createdAt: ag.tenant.createdAt ? ag.tenant.createdAt.toISOString() : EPOCH_ISO_STRING,
      updatedAt: ag.tenant.updatedAt ? ag.tenant.updatedAt.toISOString() : (ag.tenant.createdAt ? ag.tenant.createdAt.toISOString() : EPOCH_ISO_STRING)
    } : null,
    space: ag.space ? {
        ...(ag.space as SpacePrismaOriginal & { building: BuildingPrismaOriginal & { penaltyPolicyTiers: PenaltyTierPrismaOriginal[]; spaces: SpacePrismaOriginal[] } }),
        createdAt: ag.space.createdAt ? ag.space.createdAt.toISOString() : EPOCH_ISO_STRING,
        updatedAt: ag.space.updatedAt ? ag.space.updatedAt.toISOString() : (ag.space.createdAt ? ag.space.createdAt.toISOString() : EPOCH_ISO_STRING),
        building: ag.space.building ? {
            ...(ag.space.building as BuildingPrismaOriginal & { penaltyPolicyTiers: PenaltyTierPrismaOriginal[]; spaces: SpacePrismaOriginal[] }),
            createdAt: ag.space.building.createdAt ? ag.space.building.createdAt.toISOString() : EPOCH_ISO_STRING,
            updatedAt: ag.space.building.updatedAt ? ag.space.building.updatedAt.toISOString() : (ag.space.building.createdAt ? ag.space.building.createdAt.toISOString() : EPOCH_ISO_STRING),
            penaltyPolicyTiers: (ag.space.building.penaltyPolicyTiers || []).map(pt => ({...pt})),
            spaces: (ag.space.building.spaces || []).map(s => ({
                ...s,
                createdAt: s.createdAt ? s.createdAt.toISOString() : EPOCH_ISO_STRING,
                updatedAt: s.updatedAt?.toISOString() || (s.createdAt ? s.createdAt.toISOString() : EPOCH_ISO_STRING)
            }))
        } : null
    } : null,
  })) as SerializedBillingPageData['agreements']; // Cast to ensure type match

  const serializedSpaces = spacesData.map(s => ({
    ...(s as SpacePrismaOriginal & { building: BuildingPrismaOriginal & { penaltyPolicyTiers: PenaltyTierPrismaOriginal[]; spaces: SpacePrismaOriginal[] } }),
    createdAt: s.createdAt ? s.createdAt.toISOString() : EPOCH_ISO_STRING,
    updatedAt: s.updatedAt ? s.updatedAt.toISOString() : (s.createdAt ? s.createdAt.toISOString() : EPOCH_ISO_STRING),
    building: s.building ? {
        ...(s.building as BuildingPrismaOriginal & { penaltyPolicyTiers: PenaltyTierPrismaOriginal[]; spaces: SpacePrismaOriginal[] }),
        createdAt: s.building.createdAt ? s.building.createdAt.toISOString() : EPOCH_ISO_STRING,
        updatedAt: s.building.updatedAt ? s.building.updatedAt.toISOString() : (s.building.createdAt ? s.building.createdAt.toISOString() : EPOCH_ISO_STRING),
        penaltyPolicyTiers: (s.building.penaltyPolicyTiers || []).map(pt => ({...pt})),
          spaces: (s.building.spaces || []).map(sp => ({
            ...sp,
            createdAt: sp.createdAt ? sp.createdAt.toISOString() : EPOCH_ISO_STRING,
            updatedAt: sp.updatedAt?.toISOString() || (sp.createdAt ? sp.createdAt.toISOString() : EPOCH_ISO_STRING)
        }))
    } : null
  })) as SerializedBillingPageData['spaces'];

  const serializedBuildings = buildingsData.map(b => ({
    ...(b as BuildingPrismaOriginal & { penaltyPolicyTiers: PenaltyTierPrismaOriginal[]; spaces: SpacePrismaOriginal[] }),
    createdAt: b.createdAt ? b.createdAt.toISOString() : EPOCH_ISO_STRING,
    updatedAt: b.updatedAt ? b.updatedAt.toISOString() : (b.createdAt ? b.createdAt.toISOString() : EPOCH_ISO_STRING),
    penaltyPolicyTiers: (b.penaltyPolicyTiers || []).map(pt => ({...pt})),
    spaces: (b.spaces || []).map(s => ({
        ...s,
        createdAt: s.createdAt ? s.createdAt.toISOString() : EPOCH_ISO_STRING,
        updatedAt: s.updatedAt?.toISOString() || (s.createdAt ? s.createdAt.toISOString() : EPOCH_ISO_STRING)
    }))
  })) as SerializedBillingPageData['buildings'];
  
  const serializedBills = billsDataRaw.map(billRaw => {
    let parsedUtilityBreakdown: SerializedParsedUtilityItem[] = [];
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
    
    const billCreatedAt = billRaw.createdAt ? billRaw.createdAt.toISOString() : EPOCH_ISO_STRING;
    const billUpdatedAt = billRaw.updatedAt ? billRaw.updatedAt.toISOString() : billCreatedAt;
    const agreementForBill = billRaw.agreement as (AgreementPrismaOriginal & { tenant: TenantPrismaOriginal; space: SpacePrismaOriginal & { building: BuildingPrismaOriginal & { penaltyPolicyTiers: PenaltyTierPrismaOriginal[]; spaces: SpacePrismaOriginal[] } } });

    return {
      ...(billRaw as BillPrismaOriginal),
      createdAt: billCreatedAt,
      updatedAt: billUpdatedAt,
      billDate: billRaw.billDate ? billRaw.billDate.toISOString() : EPOCH_ISO_STRING,
      dueDate: billRaw.dueDate ? billRaw.dueDate.toISOString() : EPOCH_ISO_STRING,
      paymentDate: billRaw.paymentDate?.toISOString() || null,
      utilityBreakdown: parsedUtilityBreakdown,
      agreement: agreementForBill ? {
          ...(agreementForBill),
          createdAt: agreementForBill.createdAt ? agreementForBill.createdAt.toISOString() : EPOCH_ISO_STRING,
          updatedAt: agreementForBill.updatedAt ? agreementForBill.updatedAt.toISOString() : (agreementForBill.createdAt ? agreementForBill.createdAt.toISOString() : EPOCH_ISO_STRING),
          startDate: agreementForBill.startDate ? agreementForBill.startDate.toISOString() : EPOCH_ISO_STRING,
          nextPaymentDueDate: agreementForBill.nextPaymentDueDate ? agreementForBill.nextPaymentDueDate.toISOString() : EPOCH_ISO_STRING,
          initialPaymentDate: agreementForBill.initialPaymentDate?.toISOString() || null,
          endDate: agreementForBill.endDate?.toISOString() || null,
          tenant: agreementForBill.tenant ? {
            ...(agreementForBill.tenant),
            createdAt: agreementForBill.tenant.createdAt ? agreementForBill.tenant.createdAt.toISOString() : EPOCH_ISO_STRING,
            updatedAt: agreementForBill.tenant.updatedAt ? agreementForBill.tenant.updatedAt.toISOString() : (agreementForBill.tenant.createdAt ? agreementForBill.tenant.createdAt.toISOString() : EPOCH_ISO_STRING)
          } : null,
          space: agreementForBill.space ? {
              ...(agreementForBill.space),
              createdAt: agreementForBill.space.createdAt ? agreementForBill.space.createdAt.toISOString() : EPOCH_ISO_STRING,
              updatedAt: agreementForBill.space.updatedAt ? agreementForBill.space.updatedAt.toISOString() : (agreementForBill.space.createdAt ? agreementForBill.space.createdAt.toISOString() : EPOCH_ISO_STRING),
              building: agreementForBill.space.building ? {
                    ...(agreementForBill.space.building),
                    createdAt: agreementForBill.space.building.createdAt ? agreementForBill.space.building.createdAt.toISOString() : EPOCH_ISO_STRING,
                    updatedAt: agreementForBill.space.building.updatedAt ? agreementForBill.space.building.updatedAt.toISOString() : (agreementForBill.space.building.createdAt ? agreementForBill.space.building.createdAt.toISOString() : EPOCH_ISO_STRING),
                    penaltyPolicyTiers: (agreementForBill.space.building.penaltyPolicyTiers || []).map(pt => ({...pt})),
                    spaces: (agreementForBill.space.building.spaces || []).map(s => ({
                      ...s,
                      createdAt: s.createdAt ? s.createdAt.toISOString() : EPOCH_ISO_STRING,
                      updatedAt: s.updatedAt?.toISOString() || (s.createdAt ? s.createdAt.toISOString() : EPOCH_ISO_STRING)
                  }))
              } : null
          } : null,
      } : null,
    };
  }) as SerializedBillingPageData['bills'];

  const serializedBuildingMonthlyUtilities = buildingMonthlyUtilitiesData.map(bu => ({
    ...(bu as BuildingMonthlyUtilitiesPrisma & { utilities: Prisma.BuildingUtilityItemGetPayload<{}>[] }),
    createdAt: bu.createdAt ? bu.createdAt.toISOString() : EPOCH_ISO_STRING,
    updatedAt: bu.updatedAt ? bu.updatedAt.toISOString() : (bu.createdAt ? bu.createdAt.toISOString() : EPOCH_ISO_STRING),
    utilities: (bu.utilities || []).map(u => ({...u})) 
  })) as SerializedBillingPageData['buildingMonthlyUtilities'];

  return { 
    agreements: serializedAgreements, 
    spaces: serializedSpaces, 
    buildings: serializedBuildings, 
    bills: serializedBills, 
    buildingMonthlyUtilities: serializedBuildingMonthlyUtilities 
  };
}

function calculateIndividualPenalty(
  billAmount: number, 
  daysOverdue: number,
  building: BuildingPrismaOriginal & { penaltyPolicyTiers: Prisma.PenaltyTierGetPayload<{}>[]; spaces: SpacePrismaOriginal[] },
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
    const targetBillDate = parseISO(`${targetBillDateStr}T00:00:00.000Z`);
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

    const targetDayStart = targetBillDate;
    const targetDayEnd = addDays(targetDayStart, 1);
    const existingBill = await databaseService.getAllBills({
        where: {
            agreementId: agreement.id,
            billDate: { gte: targetDayStart, lt: targetDayEnd },
            OR: [{status: 'Pending'}, {status: 'Overdue'}, {status: 'PendingVerification'}]
        }
    });
    if (existingBill.length > 0) {
        return { success: false, error: `A bill for ${format(targetBillDate, 'PP')} for ${agreement.tenant.name} already exists (Status: ${existingBill[0].status}).`};
    }

    const rentAmount = agreement.monthlyRentalPrice;
    const utilityItemsForJson: {name: string; amount: number}[] = []; 
    let totalUtilityCostForBill = 0;

    const utilityPeriodDate = subMonths(targetBillDate, 1);
    const utilityYear = getYear(utilityPeriodDate);
    const utilityMonth = getMonth(utilityPeriodDate);

    const monthlyBuildingUtilityData = await databaseService.getBuildingMonthlyUtilitiesByBuildingMonthYear(
      agreement.space.building.id, utilityMonth, utilityYear, { utilities: true } 
    );

    if (monthlyBuildingUtilityData?.utilities.length) {
      const allUtilitiesForPeriod = monthlyBuildingUtilityData.utilities;
      const space = agreement.space;

      allUtilitiesForPeriod.forEach(utilItem => {
        let cost = 0;
        
        // Handle building-wide utilities based on proration share
        if (utilItem.appliesToScope === 'Building') {
          cost = utilItem.totalCost * (space.utilityProrationShare || 0);
        }
        
        // Handle utilities assigned to specific spaces. This now covers both
        // "Specific Floor" and "Specific Spaces" from the UI, as both are saved
        // as 'SpecificSpaces' with pre-calculated final costs.
        else if (utilItem.appliesToScope === 'SpecificSpaces') {
          if (utilItem.applicableSpaceIdNames?.includes(space.spaceIdName)) {
            // The totalCost here is the final, pre-calculated amount for this space.
            cost = utilItem.totalCost;
          }
        }
        
        if (cost > 0) {
          const roundedCost = parseFloat(cost.toFixed(2));
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
    
    let parsedUtilityBreakdown: any[] = [];
    if (typeof newBill.utilityBreakdown === 'string') {
        try {
            parsedUtilityBreakdown = JSON.parse(newBill.utilityBreakdown);
        } catch (e) { /* ignore */ }
    } else if (Array.isArray(newBill.utilityBreakdown)) {
        parsedUtilityBreakdown = newBill.utilityBreakdown;
    }

    const serializedBill = {
      ...newBill,
      billDate: newBill.billDate.toISOString(),
      dueDate: newBill.dueDate.toISOString(),
      createdAt: newBill.createdAt.toISOString(),
      updatedAt: newBill.updatedAt.toISOString(),
      paymentDate: newBill.paymentDate?.toISOString() || null,
      utilityBreakdown: parsedUtilityBreakdown,
    };
    
    return { success: true, bill: serializedBill };

  } catch (error: any) {
    console.error("Error generating bill:", error);
    return { success: false, error: error.message || "Failed to generate bill." };
  }
}

export async function recordPaymentOrVerificationAction(
  billId: string,
  paymentData: {
    paymentDate: string; 
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

    let utilityBreakdownItems: SerializedParsedUtilityItem[] = [];
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
    } else if (Array.isArray((bill as any).utilityBreakdown)) {
        utilityBreakdownItems = ((bill as any).utilityBreakdown as any[])
            .filter(item => typeof item.name === 'string' && typeof item.amount === 'number')
            .map(item => ({ name: item.name, amount: item.amount, id: item.id }));
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
    
    let parsedUtilityBreakdown: any[] = [];
    if (typeof updatedBill.utilityBreakdown === 'string') {
        try {
            parsedUtilityBreakdown = JSON.parse(updatedBill.utilityBreakdown);
        } catch (e) { /* ignore */ }
    } else if (Array.isArray(updatedBill.utilityBreakdown)) {
        parsedUtilityBreakdown = updatedBill.utilityBreakdown;
    }

    const serializedBill = {
      ...updatedBill,
      billDate: updatedBill.billDate.toISOString(),
      dueDate: updatedBill.dueDate.toISOString(),
      createdAt: updatedBill.createdAt.toISOString(),
      updatedAt: updatedBill.updatedAt.toISOString(),
      paymentDate: updatedBill.paymentDate?.toISOString() || null,
      utilityBreakdown: parsedUtilityBreakdown,
    };
    
    return { success: true, bill: serializedBill };
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
    
    

    






