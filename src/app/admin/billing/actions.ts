

"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma, type Agreement as AgreementPrismaOriginal, type Bill as BillPrismaOriginal, type Space as SpacePrismaOriginal, type Building as BuildingPrismaOriginal, type BuildingMonthlyUtilities as BuildingMonthlyUtilitiesPrisma, type UtilityBreakdownItem as UtilityBreakdownItemPrismaOriginal, type PenaltyTier as PenaltyTierPrismaOriginal, type Tenant as TenantPrismaOriginal, type User, type Role } from '@prisma/client';
import { addMonths, getMonth, getYear, startOfDay, differenceInDays, isBefore, setMonth, setYear, parseISO, format, addDays, subMonths, isSameDay, isAfter, differenceInCalendarMonths } from 'date-fns';
import type { SerializedBillingPageData, SerializedParsedUtilityItem } from './page'; // Import serialized types from page.tsx for return type
import { cookies } from 'next/headers';
import { getUserAndManagedIds } from '@/lib/actions/server-helpers';

const EPOCH_ISO_STRING = new Date(0).toISOString();

export async function getBillingPageDataAction(): Promise<SerializedBillingPageData> {
  const { isSuperAdmin, managedBuildingIds, currentUser } = await getUserAndManagedIds();

  if (!isSuperAdmin && managedBuildingIds?.length === 0) {
      // Return empty data if user manages no buildings
      return { agreements: [], spaces: [], buildings: [], bills: [], buildingMonthlyUtilities: [] };
  }

  // Define where clauses
  const agreementWhere: Prisma.AgreementWhereInput = {
    ...(!isSuperAdmin ? { space: { buildingId: { in: managedBuildingIds! } } } : {}),
  };

  const spaceWhere: Prisma.SpaceWhereInput = !isSuperAdmin ? { buildingId: { in: managedBuildingIds! } } : {};
  const buildingWhere: Prisma.BuildingWhereInput = !isSuperAdmin ? { id: { in: managedBuildingIds! } } : {};
  
  const billWhere: Prisma.BillWhereInput = {
    ...(!isSuperAdmin ? { agreement: { space: { buildingId: { in: managedBuildingIds! } } } } : {}),
  };
  
  const today = new Date();
  const currentMonth = getMonth(today);
  const currentYear = getYear(today);
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const buildingMonthlyUtilityWhere: Prisma.BuildingMonthlyUtilitiesWhereInput = {
    OR: [
      { year: currentYear, month: currentMonth },
      { year: prevMonthYear, month: prevMonth },
    ]
  };
  if(!isSuperAdmin) {
      buildingMonthlyUtilityWhere.buildingId = { in: managedBuildingIds! };
  }


  const [agreementsData, spacesData, buildingsData, billsDataRaw, buildingMonthlyUtilitiesData] = await Promise.all([
    databaseService.getAllAgreements({
      where: agreementWhere,
      include: {
        tenant: true,
        space: {
          include: {
            building: { include: { penaltyPolicyTiers: true, spaces: true } } 
          }
        },
      },
      orderBy: { tenant: { name: 'asc' } }
    }),
    databaseService.getAllSpaces({
      where: spaceWhere,
      include: {
        building: { include: { penaltyPolicyTiers: true, spaces: true } } 
      }
    }),
    databaseService.getAllBuildings({ where: buildingWhere, include: { penaltyPolicyTiers: true, spaces: true } }), 
    databaseService.getAllBills({ 
      where: billWhere,
      include: {
        agreement: {
          include: {
            tenant: true,
            space: {
              include: {
                building: { include: { penaltyPolicyTiers: true, spaces: true } } 
              }
            },
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    databaseService.getAllBuildingMonthlyUtilities({
      where: buildingMonthlyUtilityWhere,
      include: { utilities: true }
    })
  ]);

  // Serialization logic moved here
  const serializedAgreements = agreementsData.map(ag => ({
    ...(ag as AgreementPrismaOriginal & { tenant: TenantPrismaOriginal | null; space: (SpacePrismaOriginal & { building: (BuildingPrismaOriginal & { penaltyPolicyTiers: PenaltyTierPrismaOriginal[]; spaces: SpacePrismaOriginal[] }) | null }) | null }),
    monthlyRentalPrice: Number(ag.monthlyRentalPrice),
    initialPaymentAmount: ag.initialPaymentAmount ? Number(ag.initialPaymentAmount) : null,
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
        ...(ag.space as SpacePrismaOriginal & { building: (BuildingPrismaOriginal & { penaltyPolicyTiers: PenaltyTierPrismaOriginal[]; spaces: SpacePrismaOriginal[] }) | null }),
        area: Number(ag.space.area),
        utilityProrationShare: Number(ag.space.utilityProrationShare),
        monthlyRentalPrice: Number(ag.space.monthlyRentalPrice),
        createdAt: ag.space.createdAt ? ag.space.createdAt.toISOString() : EPOCH_ISO_STRING,
        updatedAt: ag.space.updatedAt ? ag.space.updatedAt.toISOString() : (ag.space.createdAt ? ag.space.createdAt.toISOString() : EPOCH_ISO_STRING),
        building: ag.space.building ? {
            ...(ag.space.building as BuildingPrismaOriginal & { penaltyPolicyTiers: PenaltyTierPrismaOriginal[]; spaces: SpacePrismaOriginal[] }),
            createdAt: ag.space.building.createdAt ? ag.space.building.createdAt.toISOString() : EPOCH_ISO_STRING,
            updatedAt: ag.space.building.updatedAt ? ag.space.building.updatedAt.toISOString() : (ag.space.building.createdAt ? ag.space.building.createdAt.toISOString() : EPOCH_ISO_STRING),
            penaltyPolicyTiers: (ag.space.building.penaltyPolicyTiers || []).map(pt => ({...pt, feeValue: Number(pt.feeValue)})),
            spaces: (ag.space.building.spaces || []).map(s => ({
                ...s,
                area: Number(s.area),
                utilityProrationShare: Number(s.utilityProrationShare),
                monthlyRentalPrice: Number(s.monthlyRentalPrice),
                createdAt: s.createdAt ? s.createdAt.toISOString() : EPOCH_ISO_STRING,
                updatedAt: s.updatedAt?.toISOString() || (s.createdAt ? s.createdAt.toISOString() : EPOCH_ISO_STRING)
            }))
        } : null
    } : null,
  })) as SerializedBillingPageData['agreements']; // Cast to ensure type match

  const serializedSpaces = spacesData.map(s => ({
    ...(s as SpacePrismaOriginal & { building: (BuildingPrismaOriginal & { penaltyPolicyTiers: PenaltyTierPrismaOriginal[]; spaces: SpacePrismaOriginal[] }) | null }),
    area: Number(s.area),
    utilityProrationShare: Number(s.utilityProrationShare),
    monthlyRentalPrice: Number(s.monthlyRentalPrice),
    createdAt: s.createdAt ? s.createdAt.toISOString() : EPOCH_ISO_STRING,
    updatedAt: s.updatedAt ? s.updatedAt.toISOString() : (s.createdAt ? s.createdAt.toISOString() : EPOCH_ISO_STRING),
    building: s.building ? {
        ...(s.building as BuildingPrismaOriginal & { penaltyPolicyTiers: PenaltyTierPrismaOriginal[]; spaces: SpacePrismaOriginal[] }),
        createdAt: s.building.createdAt ? s.building.createdAt.toISOString() : EPOCH_ISO_STRING,
        updatedAt: s.building.updatedAt ? s.building.updatedAt.toISOString() : (s.building.createdAt ? s.building.createdAt.toISOString() : EPOCH_ISO_STRING),
        penaltyPolicyTiers: (s.building.penaltyPolicyTiers || []).map(pt => ({...pt, feeValue: Number(pt.feeValue)})),
          spaces: (s.building.spaces || []).map(sp => ({
            ...sp,
            area: Number(sp.area),
            utilityProrationShare: Number(sp.utilityProrationShare),
            monthlyRentalPrice: Number(sp.monthlyRentalPrice),
            createdAt: sp.createdAt ? sp.createdAt.toISOString() : EPOCH_ISO_STRING,
            updatedAt: sp.updatedAt?.toISOString() || (sp.createdAt ? sp.createdAt.toISOString() : EPOCH_ISO_STRING)
        }))
    } : null
  })) as SerializedBillingPageData['spaces'];

  const serializedBuildings = buildingsData.map(b => ({
    ...(b as BuildingPrismaOriginal & { penaltyPolicyTiers: PenaltyTierPrismaOriginal[]; spaces: SpacePrismaOriginal[] }),
    status: b.status || 'Active',
    createdAt: b.createdAt ? b.createdAt.toISOString() : EPOCH_ISO_STRING,
    updatedAt: b.updatedAt ? b.updatedAt.toISOString() : (b.createdAt ? b.createdAt.toISOString() : EPOCH_ISO_STRING),
    penaltyPolicyTiers: (b.penaltyPolicyTiers || []).map(pt => ({...pt, feeValue: Number(pt.feeValue)})),
    spaces: (b.spaces || []).map(s => ({
        ...s,
        area: Number(s.area),
        utilityProrationShare: Number(s.utilityProrationShare),
        monthlyRentalPrice: Number(s.monthlyRentalPrice),
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
    const agreementForBill = billRaw.agreement as (AgreementPrismaOriginal & { tenant: TenantPrismaOriginal | null; space: (SpacePrismaOriginal & { building: (BuildingPrismaOriginal & { penaltyPolicyTiers: PenaltyTierPrismaOriginal[]; spaces: SpacePrismaOriginal[] }) | null }) | null });

    return {
      ...(billRaw as BillPrismaOriginal),
      rentAmount: Number(billRaw.rentAmount),
      penaltyAmount: billRaw.penaltyAmount ? Number(billRaw.penaltyAmount) : null,
      totalAmount: Number(billRaw.totalAmount),
      createdAt: billCreatedAt,
      updatedAt: billUpdatedAt,
      billDate: billRaw.billDate ? billRaw.billDate.toISOString() : EPOCH_ISO_STRING,
      dueDate: billRaw.dueDate ? billRaw.dueDate.toISOString() : EPOCH_ISO_STRING,
      paymentDate: billRaw.paymentDate?.toISOString() || null,
      utilityBreakdown: parsedUtilityBreakdown,
      agreement: agreementForBill ? {
          ...(agreementForBill),
          monthlyRentalPrice: Number(agreementForBill.monthlyRentalPrice),
          initialPaymentAmount: agreementForBill.initialPaymentAmount ? Number(agreementForBill.initialPaymentAmount) : null,
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
              area: Number(agreementForBill.space.area),
              utilityProrationShare: Number(agreementForBill.space.utilityProrationShare),
              monthlyRentalPrice: Number(agreementForBill.space.monthlyRentalPrice),
              createdAt: agreementForBill.space.createdAt ? agreementForBill.space.createdAt.toISOString() : EPOCH_ISO_STRING,
              updatedAt: agreementForBill.space.updatedAt ? agreementForBill.space.updatedAt.toISOString() : (agreementForBill.space.createdAt ? agreementForBill.space.createdAt.toISOString() : EPOCH_ISO_STRING),
              building: agreementForBill.space.building ? {
                    ...(agreementForBill.space.building),
                    status: agreementForBill.space.building.status || 'Active',
                    createdAt: agreementForBill.space.building.createdAt ? agreementForBill.space.building.createdAt.toISOString() : EPOCH_ISO_STRING,
                    updatedAt: agreementForBill.space.building.updatedAt ? agreementForBill.space.building.updatedAt.toISOString() : (agreementForBill.space.building.createdAt ? agreementForBill.space.building.createdAt.toISOString() : EPOCH_ISO_STRING),
                    penaltyPolicyTiers: (agreementForBill.space.building.penaltyPolicyTiers || []).map(pt => ({...pt, feeValue: Number(pt.feeValue)})),
                    spaces: (agreementForBill.space.building.spaces || []).map(s => ({
                      ...s,
                      area: Number(s.area),
                      utilityProrationShare: Number(s.utilityProrationShare),
                      monthlyRentalPrice: Number(s.monthlyRentalPrice),
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
    utilities: (bu.utilities || []).map(u => ({...u, totalCost: Number(u.totalCost)})) 
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
  building: BuildingPrismaOriginal & { penaltyPolicyTiers: Prisma.PenaltyTierGetPayload<{}>[] },
  space: SpacePrismaOriginal
): number {
  if (daysOverdue <= 0 || !building.penaltyPolicyTiers || building.penaltyPolicyTiers.length === 0) {
    return 0;
  }

  const allTiers = building.penaltyPolicyTiers;
  
  // Prioritize rules: Specific Space > Floor > Building
  const spaceSpecificTiers = allTiers.filter(
    t => t.scope === 'SpecificSpaces' && t.applicableSpaceIdNames?.includes(space.spaceIdName)
  );

  const floorSpecificTiers = allTiers.filter(
    t => t.scope === 'Floor' && t.applicableFloor === space.floor
  );
  
  const buildingWideTiers = allTiers.filter(t => t.scope === 'Building');

  let applicableTiers: Prisma.PenaltyTierGetPayload<{}>[] = [];
  if (spaceSpecificTiers.length > 0) {
    applicableTiers = spaceSpecificTiers;
  } else if (floorSpecificTiers.length > 0) {
    applicableTiers = floorSpecificTiers;
  } else {
    applicableTiers = buildingWideTiers;
  }

  if (applicableTiers.length === 0) return 0;

  const sortedTiers = [...applicableTiers].sort((a, b) => a.fromDay - b.fromDay);
  
  let totalPenalty = 0;
  const oneTimeFeesApplied = new Set<string>(); // Keep track of applied one-time fees to prevent re-application

  // Iterate through each overdue day
  for (let day = 1; day <= daysOverdue; day++) {
    // Find the tier that applies to the current day
    const tierForDay = sortedTiers.find(tier => 
      day >= tier.fromDay && (tier.toDay === null || tier.toDay === undefined || day <= tier.toDay)
    );

    if (tierForDay) {
      const feeValue = Number(tierForDay.feeValue);
      let dailyFee = 0;
      
      if (tierForDay.penaltyType === 'Fixed') {
        dailyFee = feeValue;
      } else if (tierForDay.penaltyType === 'Percentage') {
        dailyFee = billAmount * (feeValue / 100);
      }
      
      if (tierForDay.frequency === 'Daily') {
        totalPenalty += dailyFee;
      } else if (tierForDay.frequency === 'OneTime') {
        // Only add the one-time fee if it hasn't been added for this tier yet
        if (!oneTimeFeesApplied.has(tierForDay.id)) {
          totalPenalty += dailyFee; // dailyFee here is the one-time amount
          oneTimeFeesApplied.add(tierForDay.id);
        }
      }
    }
  }
  
  return parseFloat(totalPenalty.toFixed(2));
}


export async function generateBillAndUpdateAgreementAction(agreementId: string, targetBillDateStr: string) {
  try {
    const { isSuperAdmin, managedBuildingIds } = await getUserAndManagedIds();
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

    if (!isSuperAdmin && !managedBuildingIds?.includes(agreement.space.buildingId)) {
        return { success: false, error: "Permission denied." };
    }

    const targetDayStart = targetBillDate;
    const targetDayEnd = addDays(targetDayStart, 1);
    
    // Check for ANY existing bill for this agreement on the target date.
    // This will find the initial "Paid" bill and prevent duplicates.
    const existingBill = await databaseService.getAllBills({
        where: {
            agreementId: agreement.id,
            billDate: { gte: targetDayStart, lt: targetDayEnd },
        }
    });

    if (existingBill.length > 0) {
        return { success: false, error: `A bill for ${format(targetBillDate, 'PP')} for ${agreement.tenant?.name || 'this tenant'} already exists (Status: ${existingBill[0].status}).`};
    }

    // --- Corrected Rent Calculation Logic ---
    let rentAmount = agreement.monthlyRentalPrice; // Assume full rent by default
    
    // Calculate how many months have passed from the agreement start date to the current bill's date.
    // This correctly handles cases across year boundaries.
    const monthsPassed = differenceInCalendarMonths(targetBillDate, agreement.startDate);

    // If the number of months passed is less than the number of months paid upfront, rent is zero.
    // The first bill is for month 0, second for month 1, etc.
    if (agreement.initialPaymentMonths > 0 && monthsPassed < agreement.initialPaymentMonths) {
        rentAmount = new Prisma.Decimal(0);
    }
    // --- End Corrected Logic ---
    
    // Calculate Utility Costs
    const utilityItemsForJson: {name: string; amount: number}[] = []; 
    let totalUtilityCostForBill = 0;

    const utilityYear = getYear(targetBillDate);
    const utilityMonth = getMonth(targetBillDate);

    const monthlyBuildingUtilityData = await databaseService.getBuildingMonthlyUtilitiesByBuildingMonthYear(
      agreement.space.building.id, utilityMonth, utilityYear, { utilities: true } 
    );

    if (monthlyBuildingUtilityData && monthlyBuildingUtilityData.utilities && monthlyBuildingUtilityData.utilities.length > 0) {
      const allUtilitiesForPeriod = monthlyBuildingUtilityData.utilities;
      const space = agreement.space;

      for (const utilItem of allUtilitiesForPeriod) {
        let costForThisItem = 0;
        const utilTotalCost = Number(utilItem.totalCost);
        if (isNaN(utilTotalCost)) continue;

        if (utilItem.appliesToScope === 'Building') {
          const prorationShare = Number(space.utilityProrationShare);
          if (!isNaN(prorationShare) && prorationShare > 0) {
            costForThisItem = utilTotalCost * prorationShare;
          }
        } else if (utilItem.appliesToScope === 'Floor' && utilItem.applicableFloor === space.floor) {
           let percentages: Record<string, number> = {};
           if (utilItem.perSpaceAllocation && typeof utilItem.perSpaceAllocation === 'string') {
               try { percentages = JSON.parse(utilItem.perSpaceAllocation); } catch(e) {}
           }
           const spacePercentage = percentages[space.id];
           if(spacePercentage && spacePercentage > 0) {
              costForThisItem = utilTotalCost * (spacePercentage / 100);
           }
        } else if (utilItem.appliesToScope === 'SpecificSpaces') {
          if (Array.isArray(utilItem.applicableSpaceIdNames) && utilItem.applicableSpaceIdNames.includes(space.spaceIdName)) {
            costForThisItem = utilTotalCost;
          }
        }
        
        if (costForThisItem > 0) {
          const roundedCost = parseFloat(costForThisItem.toFixed(2));
          utilityItemsForJson.push({ name: utilItem.name, amount: roundedCost });
          totalUtilityCostForBill += roundedCost;
        }
      }
    }

    let initialPenalty = 0;
    const dueDate = targetBillDate; 
    if (isBefore(dueDate, today)) { 
        const daysOverdue = differenceInDays(today, dueDate); 
        initialPenalty = calculateIndividualPenalty(Number(rentAmount), daysOverdue, agreement.space.building, agreement.space);
    }

    const totalAmount = Number(rentAmount) + totalUtilityCostForBill + initialPenalty;
    
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
      rentAmount: Number(newBill.rentAmount),
      penaltyAmount: newBill.penaltyAmount ? Number(newBill.penaltyAmount) : null,
      totalAmount: Number(newBill.totalAmount),
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
    paymentReference?: string | null;
    adminVerificationNotes?: string | null;
    paymentProofDataUri?: string | null; 
  },
  actionType: 'recordPayment' | 'confirmVerification' | 'rejectVerification'
) {
  try {
    const { isSuperAdmin, managedBuildingIds } = await getUserAndManagedIds();
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

    if (!isSuperAdmin && !managedBuildingIds?.includes(bill.agreement.space.buildingId)) {
        return { success: false, error: "Permission denied." };
    }

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
    const finalPaymentDate = paymentData.paymentDate ? parseISO(paymentData.paymentDate) : new Date();

    let currentPenalty = bill.penaltyAmount ? Number(bill.penaltyAmount) : 0;
    
    if ( (isBefore(parseISO(bill.dueDate.toISOString()), finalPaymentDate) || bill.status === 'Overdue') && actionType !== 'rejectVerification') {
        const daysOverdue = differenceInDays(finalPaymentDate, parseISO(bill.dueDate.toISOString()));
        if (daysOverdue > 0) {
             // Recalculate penalty on payment date
             currentPenalty = calculateIndividualPenalty(Number(bill.rentAmount), daysOverdue, bill.agreement.space.building, bill.agreement.space);
        } else { 
            currentPenalty = 0;
        }
    }

    const billUpdateData: Prisma.BillUpdateInput = {
      paymentReference: paymentData.paymentReference,
      adminVerificationNotes: paymentData.adminVerificationNotes,
      penaltyAmount: currentPenalty > 0 ? currentPenalty : null,
    };

    const baseAmount = Number(bill.rentAmount) + (utilityBreakdownItems.reduce((sum, util) => sum + util.amount, 0) || 0);
    billUpdateData.totalAmount = parseFloat((baseAmount + (currentPenalty > 0 ? currentPenalty : 0)).toFixed(2));


    if (actionType === 'recordPayment' || actionType === 'confirmVerification') {
      newStatus = 'Paid';
      billUpdateData.paymentDate = finalPaymentDate;
      billUpdateData.adminVerifiedPayment = true;
      billUpdateData.paymentMethod = actionType === 'recordPayment' ? 'Manual' : bill.paymentMethod;
      if (paymentData.paymentProofDataUri) { 
        billUpdateData.paymentProofDataUri = paymentData.paymentProofDataUri;
      }
    } else if (actionType === 'rejectVerification') {
      newStatus = isBefore(parseISO(bill.dueDate.toISOString()), today) ? 'Overdue' : 'Pending';
      billUpdateData.adminVerifiedPayment = false; // Explicitly set to false
      billUpdateData.paymentDate = null; 
      // Do not clear method or reference, keep them for history
      
      const rejectedBaseAmount = Number(bill.rentAmount) + (utilityBreakdownItems.reduce((sum, util) => sum + util.amount, 0) || 0);
      let rejectedPenalty = 0;
      if (newStatus === 'Overdue') {
          const daysOverdueNow = differenceInDays(today, parseISO(bill.dueDate.toISOString()));
          if (daysOverdueNow > 0) {
            rejectedPenalty = calculateIndividualPenalty(Number(bill.rentAmount), daysOverdueNow, bill.agreement.space.building, bill.agreement.space);
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
      rentAmount: Number(updatedBill.rentAmount),
      penaltyAmount: updatedBill.penaltyAmount ? Number(updatedBill.penaltyAmount) : null,
      totalAmount: Number(updatedBill.totalAmount),
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

export async function updateBillAdminDetailsAction(
  billId: string,
  data: {
    paymentReference?: string | null;
    paymentProofDataUri?: string | null;
    adminVerificationNotes?: string | null;
  }
) {
  try {
    const { isSuperAdmin, managedBuildingIds } = await getUserAndManagedIds();
    const bill = await databaseService.getBillById(billId, {
      agreement: { include: { space: true } },
    });

    if (!bill) {
      return { success: false, error: "Bill not found." };
    }
    
    if (!isSuperAdmin && (!bill.agreement?.space?.buildingId || !managedBuildingIds?.includes(bill.agreement.space.buildingId))) {
      return { success: false, error: "Permission denied." };
    }

    const updateData: Prisma.BillUpdateInput = {};
    if (data.paymentReference !== undefined) {
      updateData.paymentReference = data.paymentReference;
    }
    if (data.paymentProofDataUri !== undefined) {
      updateData.paymentProofDataUri = data.paymentProofDataUri;
    }
    if (data.adminVerificationNotes !== undefined) {
      updateData.adminVerificationNotes = data.adminVerificationNotes;
    }

    const updatedBill = await databaseService.updateBill(billId, updateData);

    revalidatePath('/admin/billing');
    
    // Serialize and return bill
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
      rentAmount: Number(updatedBill.rentAmount),
      penaltyAmount: updatedBill.penaltyAmount ? Number(updatedBill.penaltyAmount) : null,
      totalAmount: Number(updatedBill.totalAmount),
      billDate: updatedBill.billDate.toISOString(),
      dueDate: updatedBill.dueDate.toISOString(),
      createdAt: updatedBill.createdAt.toISOString(),
      updatedAt: updatedBill.updatedAt.toISOString(),
      paymentDate: updatedBill.paymentDate?.toISOString() || null,
      utilityBreakdown: parsedUtilityBreakdown,
    };
    
    return { success: true, bill: serializedBill };
  } catch (error: any) {
    console.error("Error updating bill details:", error);
    return { success: false, error: error.message || "Failed to update bill details." };
  }
}
