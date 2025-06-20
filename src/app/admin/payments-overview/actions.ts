
// src/app/admin/payments-overview/actions.ts
"use server";

import { databaseService } from '@/lib/services/databaseService';
import type { Bill as BillPrisma, Space as SpacePrisma, Prisma } from '@prisma/client';

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
  // Fetch bills without attempting to include utilityBreakdown as a relation if it's a scalar/JSON field
  const rawBills = await databaseService.getAllBills({
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
      // utilityBreakdown: true, // Removed to prevent Prisma error if it's a scalar
    },
    orderBy: { billDate: 'desc' }
  });

  const bills: PaymentsOverviewBill[] = rawBills.map(rawBill => {
    let parsedUtilityBreakdown: ParsedUtilityItem[] = [];
    const rawUtilityData = (rawBill as any).utilityBreakdown; // Access the field directly

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
      // If it's already an array (e.g. if schema has it as relation and client was fixed, or direct array from JSON type)
      parsedUtilityBreakdown = rawUtilityData
        .filter(item => typeof item.name === 'string' && typeof item.amount === 'number')
        .map(item => ({
          name: item.name,
          amount: item.amount,
          id: typeof item.id === 'string' ? item.id : undefined
        }));
    }

    // Create a new object that matches PaymentsOverviewBill type
    // Ensure all properties from BillPrisma (except original utilityBreakdown) are spread
    const { utilityBreakdown: _originalUtilityData, ...billWithoutOriginalUtility } = rawBill;
    
    return {
      ...billWithoutOriginalUtility,
      agreement: (rawBill as any).agreement, // This should be fine as it's included
      utilityBreakdown: parsedUtilityBreakdown,
    };
  }) as PaymentsOverviewBill[]; // Cast to ensure the final array matches the desired type

  const spaces = await databaseService.getAllSpaces();

  return { bills, spaces };
}
