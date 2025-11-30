
"use server";

import { databaseService } from "@/lib/services/databaseService";
import type { Bill as BillPrisma, User, Role, Prisma } from "@prisma/client";
import { nanoid } from "nanoid";
import { verifySession, ACCESS_TOKEN_COOKIE_NAME } from "@/lib/auth/jwt";
import crypto from "crypto";
import { cookies } from "next/headers";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";

async function getCurrentUser(): Promise<(User & { roles: Role[] }) | null> {
  const token = cookies().get(ACCESS_TOKEN_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await verifySession(token);
  if (session?.userId) {
    const user = await databaseService.getUserById(session.userId, {
      roles: true,
    });
    if (user) return user;
  }

  return null;
}

export async function getBillingInfoForPhoneNumberAction(phone: string) {
  try {
    const user = await databaseService.findUserByPhoneNumber(phone);
    if (!user) {
      return {
        success: false,
        error: "No user account found for this phone number.",
      };
    }

    const tenant = await databaseService.findTenantByEmailOrPhone(null, phone);
    if (!tenant) return { success: false, error: "No tenant profile found." };

    const agreementsRaw = await databaseService.getAllAgreements({
      where: {
        tenantId: tenant.id,
        status: "Active", // Only fetch active agreements
      },
      include: {
        space: {
          include: {
            building: true,
          },
        },
        bills: {
          where: {
            status: { in: ["Pending", "Overdue"] },
          },
          orderBy: {
            billDate: 'asc'
          }
        },
      },
    });

    // We only care about agreements that have outstanding bills
    const agreementsWithBills = agreementsRaw.filter(ag => ag.bills.length > 0);

    if (agreementsWithBills.length === 0) {
      return {
        success: true,
        agreements: [],
        message: "You have no outstanding bills. Thank you!",
      };
    }

    // Serialize the data for the client
    const agreements = agreementsWithBills.map((agreement) => {
      const bills = agreement.bills.map((bill) => {
        let utilityBreakdown: any[] = [];
        if (typeof bill.utilityBreakdown === "string") {
          try {
            const parsed = JSON.parse(bill.utilityBreakdown);
            if (Array.isArray(parsed)) utilityBreakdown = parsed;
          } catch {}
        } else if (Array.isArray(bill.utilityBreakdown)) {
          utilityBreakdown = bill.utilityBreakdown;
        }

        return {
          ...bill,
          rentAmount: Number(bill.rentAmount),
          totalAmount: Number(bill.totalAmount),
          penaltyAmount: bill.penaltyAmount ? Number(bill.penaltyAmount) : 0,
          utilityBreakdown,
        };
      });

      return {
        ...agreement,
        bills,
        monthlyRentalPrice: Number(agreement.monthlyRentalPrice),
        space: agreement.space ? {
          ...agreement.space,
          area: Number(agreement.space.area),
          monthlyRentalPrice: Number(agreement.space.monthlyRentalPrice),
          utilityProrationShare: Number(agreement.space.utilityProrationShare),
          building: agreement.space.building
        } : null
      };
    });

    return { success: true, agreements };
  } catch (error: any) {
    console.error("Error in getBillingInfoForPhoneNumberAction:", error);
    return { success: false, error: "Failed to retrieve billing information." };
  }
}

interface PaymentInitiationResult {
  success: boolean;
  message?: string;
  error?: string;
  paymentToken?: string;
}

export async function initiatePaymentAction(
  billIds: string[],
  amount: number,
  agreementId: string,
  nibToken: string
): Promise<PaymentInitiationResult> {
  const NIB_PAYMENT_URL = process.env.NIB_PAYMENT_URL;
  const NIB_PAYMENT_KEY = process.env.NIB_PAYMENT_KEY;
  const COMPANY_NAME = process.env.NIB_COMPANY_NAME || "BUILDING";
  const CALLBACK_URL = `${process.env.NEXT_PUBLIC_BASE_URL}/api/portal/payment-callback`;

  if (!NIB_PAYMENT_URL || !NIB_PAYMENT_KEY) {
    console.error("Server Configuration Error: NIB payment environment variables are not set.");
    return { success: false, error: "Payment service is not configured. Please contact support." };
  }

  if (!nibToken) {
    return { success: false, error: "Portal session token not found. Please re-enter from the Mini App." };
  }

  try {
    const agreement = await databaseService.getAgreementById(agreementId, { space: { include: { building: true } } });
    if (!agreement || !agreement.space?.building?.accountNumber) {
      return { success: false, error: "Building account information is missing for this agreement." };
    }
    const ACCOUNT_NO = agreement.space.building.accountNumber;

    const transactionId = nanoid(16);
    const transactionTime = format(new Date(), 'yyyyMMddHHmmss');
    
    const signatureString = [
        `accountNo=${ACCOUNT_NO}`,
        `amount=${amount}`,
        `callBackURL=${CALLBACK_URL}`,
        `companyName=${COMPANY_NAME}`,
        `Key=${NIB_PAYMENT_KEY}`,
        `token=${nibToken}`,
        `transactionId=${transactionId}`,
        `transactionTime=${transactionTime}`
    ].join('&');
    
    const signature = crypto.createHash('sha256').update(signatureString, 'utf8').digest('hex');
    
    const payload = {
        accountNo: ACCOUNT_NO,
        amount: String(amount),
        callBackURL: CALLBACK_URL,
        companyName: COMPANY_NAME,
        token: nibToken,
        transactionId: transactionId,
        transactionTime: transactionTime,
        signature: signature
    };

    const response = await fetch(NIB_PAYMENT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${nibToken}`
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();

    if (!response.ok || !responseData.token) {
      console.error("NIB API Error:", responseData);
      return { success: false, error: responseData.message || `Payment initiation failed with status ${response.status}.` };
    }

    // On successful initiation, update the bills with a reference to this transaction group
    await prisma.bill.updateMany({
        where: { id: { in: billIds } },
        data: {
            tenantPaymentNotes: `Payment initiated with NIB Super App. Group Transaction Ref: ${transactionId}`
        }
    });

    return {
      success: true,
      message: "Payment initiated successfully.",
      paymentToken: responseData.token,
    };
  } catch (error) {
    console.error("initiatePaymentAction uncaught error:", error);
    return {
      success: false,
      error: "An unexpected error occurred while initiating payment.",
    };
  }
}

export async function getBillStatusAction(billIds: string[]) {
    try {
        const currentUser = await getCurrentUser();
        if (!currentUser) return { status: 'Error', error: 'Authentication failed.' };

        const bills = await databaseService.getAllBills({ where: { id: { in: billIds } } });
        if (!bills.length) return { status: 'Error', error: 'Bills not found.' };

        if (bills.every(b => b.status === 'Paid')) return { status: 'Paid' };

        return { status: 'Pending' }; 
    } catch (e: any) {
        return { status: 'Error', error: e.message };
    }
}
