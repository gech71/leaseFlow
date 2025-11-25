

"use server";

import { databaseService } from "@/lib/services/databaseService";
import { verifySession } from '@/lib/auth/jwt';
import type { User, Role } from '@prisma/client';
import type { PortalAgreementWithRelations } from '../../dashboard/actions';

// Helper to get current user
async function getCurrentUser(): Promise<(User & { roles: Role[] }) | null> {
  const session = await verifySession();
  if (session?.userId) {
    return databaseService.getUserById(session.userId, { roles: true });
  }
  return null;
}

export async function getAgreementDetailsForPortalAction(agreementId: string): Promise<{ agreement: PortalAgreementWithRelations | null, error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { agreement: null, error: "Authentication required." };
  }
  
  const tenant = await databaseService.findTenantByEmailOrPhone(currentUser.email, currentUser.phoneNumber);
  if (!tenant) {
    return { agreement: null, error: "Tenant profile not found." };
  }
  
  const agreement = await databaseService.getAgreementById(agreementId, {
    tenant: true,
    space: {
      include: {
        building: {
          include: {
            penaltyPolicyTiers: true,
            managers: true,
          },
        },
      },
    },
    bills: {
      orderBy: { billDate: 'desc' },
    },
  });

  // Security Check: Ensure the logged-in tenant owns this agreement
  if (!agreement || agreement.tenantId !== tenant.id) {
    return { agreement: null, error: "Agreement not found or access denied." };
  }
  
  // Serialize the data before sending to the client
  const processedBills = agreement.bills.map(rawBill => {
    let parsedItems: any[] = [];
    if (typeof rawBill.utilityBreakdown === 'string') {
      try { parsedItems = JSON.parse(rawBill.utilityBreakdown); } catch (e) {}
    } else if (Array.isArray(rawBill.utilityBreakdown)) {
      parsedItems = rawBill.utilityBreakdown;
    }
    return {
      ...rawBill,
      utilityBreakdown: parsedItems,
      rentAmount: Number(rawBill.rentAmount),
      penaltyAmount: rawBill.penaltyAmount ? Number(rawBill.penaltyAmount) : null,
      totalAmount: Number(rawBill.totalAmount),
      billDate: rawBill.billDate.toISOString(),
      dueDate: rawBill.dueDate.toISOString(),
      createdAt: rawBill.createdAt.toISOString(),
      updatedAt: rawBill.updatedAt.toISOString(),
      paymentDate: rawBill.paymentDate ? rawBill.paymentDate.toISOString() : null,
    };
  });

  const serializableAgreement = {
    ...agreement,
    bills: processedBills,
    startDate: agreement.startDate.toISOString(),
    createdAt: agreement.createdAt.toISOString(),
    updatedAt: agreement.updatedAt.toISOString(),
    nextPaymentDueDate: agreement.nextPaymentDueDate.toISOString(),
    initialPaymentDate: agreement.initialPaymentDate ? agreement.initialPaymentDate.toISOString() : null,
    endDate: agreement.endDate ? agreement.endDate.toISOString() : null,
    monthlyRentalPrice: Number(agreement.monthlyRentalPrice),
    initialPaymentAmount: agreement.initialPaymentAmount ? Number(agreement.initialPaymentAmount) : null,
    space: {
      ...agreement.space,
      area: Number(agreement.space.area),
      monthlyRentalPrice: Number(agreement.space.monthlyRentalPrice),
      utilityProrationShare: Number(agreement.space.utilityProrationShare),
      createdAt: agreement.space.createdAt.toISOString(),
      updatedAt: agreement.space.updatedAt.toISOString(),
      building: {
        ...agreement.space.building,
        createdAt: agreement.space.building.createdAt.toISOString(),
        updatedAt: agreement.space.building.updatedAt.toISOString(),
        penaltyPolicyTiers: agreement.space.building.penaltyPolicyTiers.map(tier => ({
          ...tier,
          feeValue: Number(tier.feeValue)
        }))
      }
    },
    tenant: {
      ...agreement.tenant,
      createdAt: agreement.tenant.createdAt.toISOString(),
      updatedAt: agreement.tenant.updatedAt.toISOString(),
    }
  };

  return { agreement: serializableAgreement as unknown as PortalAgreementWithRelations, error: undefined };
}
