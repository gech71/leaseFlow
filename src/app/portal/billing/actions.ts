
"use server";

import { prisma } from '@/lib/prisma';
import { addMonths, isAfter, format } from 'date-fns';
import { cookies } from 'next/headers';
import crypto from 'crypto';

interface BillingResult {
  success: boolean;
  amount?: number | null;
  billId?: string | null;
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

    const activeAgreement = agreements.find(ag => 
      isAfter(addMonths(ag.startDate, ag.paymentTermMonths), new Date())
    );

    if (!activeAgreement) {
      return { success: false, error: 'No active rental agreement found for this tenant.' };
    }

    const bill = await prisma.bill.findFirst({
      where: {
        agreementId: activeAgreement.id,
        status: { in: ['Pending', 'Overdue'] },
      },
      orderBy: {
        dueDate: 'desc',
      },
    });

    if (!bill) {
      return { success: true, amount: 0, billId: null, message: 'You have no outstanding payments. Thank you!' };
    }

    return { success: true, amount: bill.totalAmount, billId: bill.id };

  } catch (error) {
    console.error("Error in getBillingAmountForPhoneNumberAction:", error);
    return { success: false, error: 'An internal server error occurred. Please try again later.' };
  }
}


// --- New Payment Action ---

interface PaymentInitiationResult {
    success: boolean;
    message?: string;
    error?: string;
    redirectUrl?: string; // NIB might return a URL to redirect the user to
    data?: any; // To return any other data from NIB
}

export async function initiatePaymentAction(billId: string, amount: number): Promise<PaymentInitiationResult> {
    const NIB_PAYMENT_URL = process.env.NIB_PAYMENT_URL;
    const NIB_PAYMENT_KEY = process.env.NIB_PAYMENT_KEY;
    const ACCOUNT_NO = process.env.NIB_ACCOUNT_NO;
    const COMPANY_NAME = process.env.NIB_COMPANY_NAME || 'BUILDING';
    const CALLBACK_URL = `${process.env.NEXT_PUBLIC_BASE_URL}/api/portal/payment-callback`;

    if (!NIB_PAYMENT_URL || !NIB_PAYMENT_KEY || !ACCOUNT_NO) {
        console.error("NIB payment environment variables are not set.");
        return { success: false, error: "Payment service is not configured correctly." };
    }

    const cookieStore = await cookies();
    const token = cookieStore.get('leaseflow_portal_access_token')?.value;

    if (!token) {
        return { success: false, error: "Authentication session not found. Please re-enter from the Mini App." };
    }

    try {
        const transactionId = crypto.randomUUID();
        const transactionTime = format(new Date(), 'yyyyMMddHHmmss');

        // Construct the signature string in the exact specified order, without sorting.
        const signatureString = [
            `accountNo=${ACCOUNT_NO}`,
            `amount=300`,
            `callBackURL=${CALLBACK_URL}`,
            `companyName=${COMPANY_NAME}`,
            `Key=${NIB_PAYMENT_KEY}`,
            `token=${token}`,
            `transactionId=${transactionId}`,
            `transactionTime=${transactionTime}`
        ].join('&');
        
        const signature = crypto.createHash('sha256').update(signatureString, 'utf8').digest('hex');
        
        const payload = {
            accountNo: ACCOUNT_NO,
            amount: "300",
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
        
        // Store the transaction ID and the generated signature on the bill for later validation.
        await prisma.bill.update({
            where: { id: billId },
            data: { 
              status: 'PendingVerification', 
              tenantPaymentNotes: `Payment initiated with NIB. Transaction ID: ${payload.transactionId}`,
              paymentReference: signature // Store the signature we created
            }
        });


        return {
            success: true,
            message: "Payment initiated successfully!",
            redirectUrl: responseData.redirectUrl, // Assuming NIB sends a URL
            data: responseData
        };

    } catch (error) {
        console.error("Error in initiatePaymentAction:", error);
        return { success: false, error: 'An unexpected error occurred while initiating payment.' };
    }
}
