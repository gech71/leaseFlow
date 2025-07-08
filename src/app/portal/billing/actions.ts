"use server";

import { prisma } from '@/lib/prisma';
import { addMonths, isAfter } from 'date-fns';

interface BillingResult {
  success: boolean;
  amount?: number | null;
  message?: string | null;
  error?: string | null;
}

export async function getBillingAmountForPhoneNumberAction(phone: string): Promise<BillingResult> {
  if (!phone || typeof phone !== 'string' || !/^\d+$/.test(phone)) {
    return { success: false, error: 'A valid phone number is required.' };
  }

  try {
    // 1. Find the tenant by their phone number
    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { phone: phone },
          { alternativePhone: phone }
        ],
      },
    });

    if (!tenant) {
      return { success: false, error: 'No tenant profile found for this phone number.' };
    }

    // 2. Find an active agreement for this tenant
    const agreements = await prisma.agreement.findMany({
      where: { tenantId: tenant.id },
      orderBy: { startDate: 'desc' }, // Get the most recent one first
    });

    const activeAgreement = agreements.find(ag => 
      isAfter(addMonths(ag.startDate, ag.paymentTermMonths), new Date())
    );

    if (!activeAgreement) {
      return { success: false, error: 'No active rental agreement found for this tenant.' };
    }

    // 3. Find the most recent "Pending" or "Overdue" bill for that agreement
    const bill = await prisma.bill.findFirst({
      where: {
        agreementId: activeAgreement.id,
        status: { in: ['Pending', 'Overdue'] },
      },
      orderBy: {
        dueDate: 'desc', // Get the most recent due bill
      },
    });

    if (!bill) {
      return { success: true, amount: 0, message: 'You have no outstanding payments. Thank you!' };
    }

    // 4. Return the total amount of the bill
    return { success: true, amount: bill.totalAmount };

  } catch (error) {
    console.error("Error in getBillingAmountForPhoneNumberAction:", error);
    return { success: false, error: 'An internal server error occurred. Please try again later.' };
  }
}
