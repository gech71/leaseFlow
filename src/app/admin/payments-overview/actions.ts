// src/app/admin/payments-overview/actions.ts
"use server";

import { databaseService } from '@/lib/services/databaseService';
import type { Bill as BillPrisma, Space as SpacePrisma, Prisma } from '@prisma/client';

// Define the structure for the data needed by the Payments Overview page
// This structure reflects the deep includes required.
export type PaymentsOverviewBill = BillPrisma & {
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
  utilityBreakdown: Prisma.UtilityBreakdownItemGetPayload<{}>[];
};

export interface PaymentsOverviewData {
  bills: PaymentsOverviewBill[];
  spaces: SpacePrisma[]; // For "Total Potential Monthly Revenue"
}

export async function getPaymentsOverviewDataAction(): Promise<PaymentsOverviewData> {
  const bills = await databaseService.getAllBills({
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
      utilityBreakdown: true // Assuming UtilityBreakdownItem is simple and doesn't need further includes
    },
    orderBy: { billDate: 'desc' }
  }) as PaymentsOverviewBill[]; // Cast to ensure the deep include structure is typed

  const spaces = await databaseService.getAllSpaces();

  return { bills, spaces };
}
