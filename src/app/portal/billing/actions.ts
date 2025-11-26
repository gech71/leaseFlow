
"use server";

import { databaseService } from "@/lib/services/databaseService";
import type {
  Bill as BillPrisma,
  Prisma,
  User,
  Role,
} from "@prisma/client";
import { nanoid } from "nanoid";
import { verifySession, ACCESS_TOKEN_COOKIE_NAME } from "@/lib/auth/jwt";
import crypto from "crypto";
import { cookies } from "next/headers";

async function getCurrentUser(): Promise<(User & { roles: Role[] }) | null> {
  const token = cookies().get(ACCESS_TOKEN_COOKIE_NAME)?.value;
  const session = await verifySession(token);
  if (session?.userId) {
    const user = await databaseService.getUserById(session.userId, {
      roles: true,
    });
    if (user) return user;
  }
  return null;
}

export async function getBillingAmountForPhoneNumberAction(phone: string) {
  try {
    const user = await databaseService.findUserByPhoneNumber(phone);
    if (!user) {
      return {
        success: false,
        error: "No user account found for this phone number.",
      };
    }

    const tenant = await databaseService.findTenantByEmailOrPhone(null, phone);
    if (!tenant) {
      return { success: false, error: "No tenant profile found." };
    }

    const rawBills = await databaseService.getAllBills({
      where: {
        tenantId: tenant.id,
        status: { in: ["Pending", "Overdue"] },
      },
    });

    if (rawBills.length === 0) {
      return { success: true, totalAmount: 0, message: "You have no outstanding bills. Thank you for your payments!" };
    }
    
    // Sanitize bills before sending to client
    const bills = rawBills.map(bill => {
        let parsedUtilityBreakdown = [];
        const rawUtilityData = (bill as any).utilityBreakdown;
        if (typeof rawUtilityData === 'string') {
            try {
                const jsonData = JSON.parse(rawUtilityData);
                if (Array.isArray(jsonData)) {
                    parsedUtilityBreakdown = jsonData;
                }
            } catch (e) {
                // Keep it as an empty array on parse error
            }
        } else if (Array.isArray(rawUtilityData)) {
            parsedUtilityBreakdown = rawUtilityData;
        }

        return { ...bill, utilityBreakdown: parsedUtilityBreakdown };
    });


    const totalAmount = bills.reduce(
      (sum, bill) => sum + Number(bill.totalAmount),
      0,
    );

    return { success: true, totalAmount, bills };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function initiatePaymentAction(
  billIds: string[],
  totalAmount: number,
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "Authentication required." };
    }

    const NIB_PAYMENT_URL = process.env.NIB_PAYMENT_URL;
    const NIB_PAYMENT_KEY = process.env.NIB_PAYMENT_KEY;
    const NIB_ACCOUNT_NO = process.env.NIB_ACCOUNT_NO;
    const NIB_COMPANY_NAME = process.env.NIB_COMPANY_NAME;
    const NEXT_PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;

    if (
      !NIB_PAYMENT_URL ||
      !NIB_PAYMENT_KEY ||
      !NIB_ACCOUNT_NO ||
      !NIB_COMPANY_NAME ||
      !NEXT_PUBLIC_BASE_URL
    ) {
      console.error("NIB payment environment variables are not fully configured.");
      return {
        success: false,
        error: "Payment service is not configured correctly.",
      };
    }

    const transactionId = nanoid(16);

    const stringToSign =
      `${totalAmount}${transactionId}${NIB_COMPANY_NAME}` +
      `${currentUser.phoneNumber}${NIB_ACCOUNT_NO}${NEXT_PUBLIC_BASE_URL}/portal/success` +
      `${NEXT_PUBLIC_BASE_URL}/portal/error${NEXT_PUBLIC_BASE_URL}/portal/cancel${NIB_PAYMENT_KEY}`;

    const signature = crypto
      .createHash("sha256")
      .update(stringToSign)
      .digest("hex");

    const payload = {
      amount: totalAmount,
      transactionId: transactionId,
      companyName: NIB_COMPANY_NAME,
      customerPhone: currentUser.phoneNumber,
      accountNumber: NIB_ACCOUNT_NO,
      successURL: `${NEXT_PUBLIC_BASE_URL}/portal/success`,
      errorURL: `${NEXT_PUBLIC_BASE_URL}/portal/error`,
      cancelURL: `${NEXT_PUBLIC_BASE_URL}/portal/cancel`,
      signature: signature,
    };
    
    // Before sending, update the bills with a reference to this transaction
    await databaseService.updateManyBills(
        { id: { in: billIds } },
        { tenantPaymentNotes: `Payment initiated with NIB SuperApp. Group Transaction Ref: ${transactionId}` }
    );
    

    const response = await fetch(NIB_PAYMENT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();

    if (!response.ok || !responseData.token) {
      console.error(
        "NIB Payment Initiation Failed:",
        responseData,
      );
      return {
        success: false,
        error: responseData.message || "Failed to initiate payment with the provider.",
      };
    }

    return { success: true, data: responseData };
  } catch (error: any) {
    console.error("Error in initiatePaymentAction:", error);
    return { success: false, error: error.message };
  }
}


export async function getBillStatusAction(billIds: string[]) {
    try {
        const currentUser = await getCurrentUser();
        if (!currentUser) return { status: 'Error', error: "Authentication failed." };

        const bills = await databaseService.getAllBills({
            where: { id: { in: billIds } }
        });

        if (bills.length === 0) return { status: 'Error', error: "Bills not found." };
        
        // If ANY of the bills are paid, we consider the group payment successful
        if (bills.some(bill => bill.status === 'Paid')) {
            return { status: 'Paid' };
        }
        
        // If ALL bills are still pending or overdue, the payment is not complete
        if (bills.every(bill => bill.status === 'Pending' || bill.status === 'Overdue')) {
             return { status: 'Pending' };
        }

        return { status: 'Mixed' }; // Some paid, some not, shouldn't happen with our logic but good to have
    } catch (e: any) {
        return { status: 'Error', error: e.message };
    }
}
