
// src/app/admin/payments-overview/actions.ts
"use server";

import { databaseService } from '@/lib/services/databaseService';
import type { Bill as BillPrisma, Space as SpacePrisma, Prisma, User, Role } from '@prisma/client';
import { cookies } from 'next/headers';
import { getUserAndManagedIds } from '@/lib/actions/server-helpers';


// Define a simple structure for parsed utility items
interface ParsedUtilityItem {
  id?: string;
  name: string;
  amount: number;
}

// Define the structure for the data needed by the Payments Overview page
// UtilityBreakdown is now an array of simple parsed items.
export type PaymentsOverviewBill = Omit<BillPrisma, 'utilityBreakdown'> & {
  agreement: Prisma.AgreementGetPayload<{
    include: {
      tenant: true;
      space: Prisma.SpaceGetPayload<{
        include: {
          building: Prisma.BuildingGetPayload<{
            include: { penaltyPolicyTiers: true }
          }>
        }
      }>
    }
  }>;
  utilityBreakdown: ParsedUtilityItem[];
};

export interface PaymentsOverviewData {
  bills: PaymentsOverviewBill[];
  spaces: SpacePrisma[]; // For "Total Potential Monthly Revenue"
}

export async function getPaymentsOverviewDataAction(): Promise<PaymentsOverviewData> {
  const { isSuperAdmin, managedBuildingIds } = await getUserAndManagedIds();

  if (!isSuperAdmin && managedBuildingIds?.length === 0) {
      return { bills: [], spaces: [] };
  }

  const billWhere: Prisma.BillWhereInput = !isSuperAdmin ? { agreement: { space: { buildingId: { in: managedBuildingIds! } } } } : {};
  const spaceWhere: Prisma.SpaceWhereInput = !isSuperAdmin ? { buildingId: { in: managedBuildingIds! } } : {};

  const rawBills = await databaseService.getAllBills({
    where: billWhere,
    include: {
      agreement: {
        include: {
          tenant: true,
          space: {
            include: {
              building: {
                include: { penaltyPolicyTiers: true }
              }
            }
          }
        }
      },
    },
    orderBy: { createdAt: 'desc' }
  });

  const bills: PaymentsOverviewBill[] = rawBills.map(rawBill => {
    let parsedUtilityBreakdown: ParsedUtilityItem[] = [];
    const rawUtilityData = (rawBill as any).utilityBreakdown;

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
        console.error(`Failed to parse utilityBreakdown JSON for bill ${rawBill.id}:`, e, rawUtilityData);
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

    const { utilityBreakdown: _originalUtilityData, ...billWithoutOriginalUtility } = rawBill;
    
    return {
      ...billWithoutOriginalUtility,
      agreement: (rawBill as any).agreement,
      utilityBreakdown: parsedUtilityBreakdown,
    };
  }) as PaymentsOverviewBill[];

  const spaces = await databaseService.getAllSpaces({ where: spaceWhere });

  return { bills, spaces };
}
