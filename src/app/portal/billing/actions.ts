
"use server";

import { prisma } from '@/lib/prisma';
import { addMonths, isAfter, format } from 'date-fns';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import type { Bill, BillStatus } from '@prisma/client';

interface BillingResult {
  success: boolean;
  bills?: (Omit<Bill, 'utilityBreakdown'> & { utilityBreakdown: any[] })[] | null;
  totalAmount?: number | null;
  message?: string | null;
  error?: string;
}

export async function getBillingAmountForPhoneNumberAction(phone: string): Promise<BillingResult> {
  if (!phone || typeof phone !== 'string' || !/^\d+$/.test(phone)) {
    return { success: false, error: 'A valid phone number is required.' };
  }

  try {
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

    const agreements = await prisma.agreement.findMany({
      where: { tenantId: tenant.id },
      orderBy: { startDate: 'desc' },
    });

    const activeAgreements = agreements.filter(ag => 
      isAfter(addMonths(ag.startDate, ag.paymentTermMonths), new Date())
    );

    if (activeAgreements.length === 0) {
      return { success: false, error: 'No active rental agreement found for this tenant.' };
    }

    const activeAgreementIds = activeAgreements.map(ag => ag.id);

    const outstandingBills = await prisma.bill.findMany({
      where: {
        agreementId: { in: activeAgreementIds },
        status: { in: ['Pending', 'Overdue'] },
      },
      orderBy: {
        dueDate: 'asc',
      },
    });

    if (outstandingBills.length === 0) {
      return { success: true, bills: [], totalAmount: 0, message: 'You have no outstanding payments. Thank you!' };
    }

    const totalAmount = outstandingBills.reduce((sum, bill) => sum + Number(bill.totalAmount), 0);
    
    // Serialize utilityBreakdown
    const serializedBills = outstandingBills.map(bill => {
        let parsedUtilityBreakdown: any[] = [];
        if(bill.utilityBreakdown && typeof bill.utilityBreakdown === 'string') {
            try {
                parsedUtilityBreakdown = JSON.parse(bill.utilityBreakdown);
            } catch(e) {/* ignore */}
        } else if (Array.isArray(bill.utilityBreakdown)) {
            parsedUtilityBreakdown = bill.utilityBreakdown;
        }

        return {
            ...bill,
            utilityBreakdown: parsedUtilityBreakdown,
        }
    });

    return { success: true, bills: serializedBills, totalAmount };

  } catch (error) {
    console.error("Error in getBillingAmountForPhoneNumberAction:", error);
    return { success: false, error: 'An internal server error occurred. Please try again later.' };
  }
}


interface PaymentInitiationResult {
    success: boolean;
    message?: string;
    error?: string;
    redirectUrl?: string; 
    data?: any; 
}

export async function initiatePaymentAction(billIds: string[], amount: number): Promise<PaymentInitiationResult> {
    const NIB_PAYMENT_URL = process.env.NIB_PAYMENT_URL;
    const NIB_PAYMENT_KEY = process.env.NIB_PAYMENT_KEY;
    const COMPANY_NAME = process.env.NIB_COMPANY_NAME || 'BUILDING';
    const CALLBACK_URL = `${process.env.NEXT_PUBLIC_BASE_URL}/api/portal/payment-callback`;

    try {
        if (billIds.length === 0) {
          return { success: false, error: "No bills selected for payment." };
        }

        const firstBill = await prisma.bill.findUnique({
            where: { id: billIds[0] },
            include: {
                agreement: {
                    include: {
                        space: {
                            include: {
                                building: true
                            }
                        }
                    }
                }
            }
        });

        if (!firstBill) {
            return { success: false, error: "Bill to be paid was not found." };
        }
        
        const buildingAccountNumber = firstBill.agreement?.space?.building?.accountNumber;

        if (!buildingAccountNumber) {
            console.error(`CRITICAL: Building account number is not set for the building associated with bill ${firstBill.id}.`);
            return { success: false, error: "The property's account information is not configured. Please contact support." };
        }

        if (!NIB_PAYMENT_URL || !NIB_PAYMENT_KEY) {
            console.error("NIB payment environment variables (URL or KEY) are not set.");
            return { success: false, error: "Payment service is not configured correctly." };
        }

        const cookieStore = await cookies();
        const token = cookieStore.get('nibrental_admin_access_token')?.value;

        if (!token) {
            return { success: false, error: "Authentication session not found. Please re-enter from the Mini App." };
        }

        const transactionId = crypto.randomUUID();
        const transactionTime = format(new Date(), 'yyyyMMddHHmmss');

        const signatureString = [
            `accountNo=${buildingAccountNumber}`,
            `amount=${amount}`,
            `callBackURL=${CALLBACK_URL}`,
            `companyName=${COMPANY_NAME}`,
            `Key=${NIB_PAYMENT_KEY}`,
            `token=${token}`,
            `transactionId=${transactionId}`,
            `transactionTime=${transactionTime}`
        ].join('&');
        
        const signature = crypto.createHash('sha256').update(signatureString, 'utf8').digest('hex');
        
        const payload = {
            accountNo: buildingAccountNumber,
            amount: String(amount),
            callBackURL: CALLBACK_URL,
            companyName: COMPANY_NAME,
            token: token,
            transactionId: transactionId,
            transactionTime: transactionTime,
            signature: signature
        };
        
        const response = await fetch(NIB_PAYMENT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload),
        });

        const responseData = await response.json();

        if (!response.ok) {
            console.error("NIB Payment API Error:", responseData);
            return { success: false, error: responseData.message || `Payment initiation failed with status ${response.status}.` };
        }
        
        // Update all bills with the same transaction reference for the callback
        await prisma.bill.updateMany({
            where: { id: { in: billIds } },
            data: { 
              tenantPaymentNotes: `Payment initiated with NIB. Group Transaction Ref: ${transactionId}`,
              paymentReference: signature
            }
        });
        
        return {
            success: true,
            message: "Payment initiated successfully!",
            redirectUrl: responseData.redirectUrl,
            data: responseData
        };

    } catch (error) {
        console.error("Error in initiatePaymentAction:", error);
        return { success: false, error: 'An unexpected error occurred while initiating payment.' };
    }
}

// --- New Bill Status Action ---
export async function getBillStatusAction(billIds: string[]): Promise<{ status: BillStatus | null, error?: string }> {
  try {
    if (billIds.length === 0) {
      return { status: null, error: "No bill IDs provided." };
    }
    // Check the status of the first bill in the batch, assuming they all get updated together.
    const bill = await prisma.bill.findUnique({
      where: { id: billIds[0] },
      select: { status: true },
    });

    if (!bill) {
      return { status: null, error: "Bill not found." };
    }

    return { status: bill.status };
  } catch (error) {
    console.error("Error fetching bill status:", error);
    return { status: null, error: "Database error." };
  }
}
