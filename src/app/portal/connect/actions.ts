// src/app/portal/connect/actions.ts
"use server";

import { databaseService } from '@/lib/services/databaseService';
import { addMonths, isAfter } from 'date-fns';

interface BillingInfoResult {
  success: boolean;
  amount: number;
  error?: string;
}

export async function getBillingInfoByPhoneAction(phone: string): Promise<BillingInfoResult> {
  if (!phone) {
    return { success: false, amount: 0, error: "Phone number is required." };
  }

  try {
    const tenant = await databaseService.findTenantByEmailOrPhone(null, phone);

    if (!tenant) {
      return { success: false, amount: 0, error: "No tenant found with this phone number." };
    }

    const agreements = await databaseService.getAllAgreements({
      where: { tenantId: tenant.id },
      include: { bills: true },
      orderBy: { startDate: 'desc' }, // Get the most recent agreement first
    });

    const activeAgreement = agreements.find(ag => {
      const agreementEndDate = addMonths(new Date(ag.startDate), ag.paymentTermMonths);
      return isAfter(agreementEndDate, new Date());
    });
    
    if (!activeAgreement) {
      return { success: false, amount: 0, error: "No active rental agreement found for this tenant." };
    }

    const outstandingBill = activeAgreement.bills
      .filter(b => b.status === 'Pending' || b.status === 'Overdue')
      .sort((a, b) => new Date(b.billDate).getTime() - new Date(a.billDate).getTime())[0]; // Get the most recent outstanding bill

    if (outstandingBill) {
      // Recalculate penalty here if needed, for simplicity we are using stored totalAmount
      return { success: true, amount: outstandingBill.totalAmount };
    }

    return { success: true, amount: 0 }; // No outstanding bills found
  
  } catch (error: any) {
    console.error("Error fetching billing info by phone:", error);
    return { success: false, amount: 0, error: "An internal error occurred while fetching billing information." };
  }
}
