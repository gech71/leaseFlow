"use server";

import { databaseService } from "@/lib/services/databaseService";
import type { Bill as BillPrisma, User, Role } from "@prisma/client";
import { nanoid } from "nanoid";
import { verifySession, ACCESS_TOKEN_COOKIE_NAME } from "@/lib/auth/jwt";
import crypto from "crypto";
import { cookies } from "next/headers";
import { format } from "date-fns";

// -------------------------
// 🔹 Helper: Validate SuperApp Token
// -------------------------
async function validateTokenAndGetPhone(
  token: string,
): Promise<{ success: boolean; phone?: string }> {
  try {
    const res = await fetch(`${process.env.SUPERAPP_AUTH_URL}/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    const data = await res.json();
    if (!res.ok || !data.phone) return { success: false };
    return { success: true, phone: data.phone };
  } catch (e) {
    console.error("SuperApp token validation error", e);
    return { success: false };
  }
}

// -------------------------
// 🔹 getCurrentUser (UNCHANGED)
// -------------------------
async function getCurrentUser(
  superAppToken?: string,
): Promise<(User & { roles: Role[] }) | null> {
  if (superAppToken) {
    const result = await validateTokenAndGetPhone(superAppToken);
    if (result.success && result.phone) {
      const user = await databaseService.findUserByPhoneNumber(result.phone);
      if (user) return user;
    }
    return null;
  }

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

// -------------------------
// 🔹 Get Billing Info (UNCHANGED)
// -------------------------
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
    if (!tenant) return { success: false, error: "No tenant profile found." };

    const billsRaw = await databaseService.getAllBills({
      where: { tenantId: tenant.id, status: { in: ["Pending", "Overdue"] } },
    });

    if (!billsRaw.length) {
      return {
        success: true,
        totalAmount: 0,
        message: "You have no outstanding bills. Thank you!",
      };
    }

    const bills = billsRaw.map((bill) => {
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

    const totalAmount = bills.reduce((sum, b) => sum + b.totalAmount, 0);

    return { success: true, totalAmount, bills };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

interface PaymentInitiationResult {
  success: boolean;
  message?: string;
  error?: string;
  redirectUrl?: string;
  data?: any;
}

// -------------------------
// 🔹 INITIATE PAYMENT — UPDATED & FIXED
// -------------------------
export async function initiatePaymentAction(
  billIds: string[],
  amount: number,
  superAppToken?: string,
): Promise<PaymentInitiationResult> {
  const NIB_PAYMENT_URL = process.env.NIB_PAYMENT_URL;
  const NIB_PAYMENT_KEY = process.env.NIB_PAYMENT_KEY;
  const COMPANY_NAME = process.env.NIB_COMPANY_NAME || "BUILDING";
  const CALLBACK_URL = `${process.env.NEXT_PUBLIC_BASE_URL}/api/portal/payment-callback`;

  try {
    if (billIds.length === 0) {
      return { success: false, error: "No bills selected for payment." };
    }

    // 🔹 Use existing correct getCurrentUser logic
    const currentUser = await getCurrentUser(superAppToken);
    if (!currentUser) {
      return {
        success: false,
        error: "Authentication required. Please re-enter from the Mini App.",
      };
    }

    // 🔹 Load first bill with building account number
    const firstBill = await databaseService.getFirstBillWithBuilding(
      billIds[0],
    );

    if (!firstBill) {
      return { success: false, error: "Bill not found." };
    }

    const buildingAccountNumber =
      firstBill.agreement?.space?.building?.accountNumber;

    if (!buildingAccountNumber) {
      return {
        success: false,
        error: "Account number for this building is missing.",
      };
    }

    if (!NIB_PAYMENT_URL || !NIB_PAYMENT_KEY) {
      return {
        success: false,
        error: "NIB payment configuration missing.",
      };
    }

    // -----------------------------------------
    // 🔹 NIB Manual Fields (correct)
    // -----------------------------------------
    const transactionId = nanoid(16);
    const transactionTime = format(new Date(), "yyyyMMddHHmmss");

    const nibToken = superAppToken || currentUser.id;

    // -----------------------------------------
    // 🔹 Signature (EXACT NIB FORMAT)
    // -----------------------------------------
    const signatureString = [
      `accountNo=${buildingAccountNumber}`,
      `amount=${amount}`,
      `callBackURL=${CALLBACK_URL}`,
      `companyName=${COMPANY_NAME}`,
      `Key=${NIB_PAYMENT_KEY}`,
      `token=${nibToken}`,
      `transactionId=${transactionId}`,
      `transactionTime=${transactionTime}`,
    ].join("&");

    const signature = crypto
      .createHash("sha256")
      .update(signatureString, "utf8")
      .digest("hex");

    // -----------------------------------------
    // 🔹 NIB Payload
    // -----------------------------------------
    const payload = {
      accountNo: buildingAccountNumber,
      amount: String(amount),
      callBackURL: CALLBACK_URL,
      companyName: COMPANY_NAME,
      token: nibToken,
      transactionId,
      transactionTime,
      signature,
    };

    // -----------------------------------------
    // 🔹 Send to NIB API
    // -----------------------------------------
    const response = await fetch(NIB_PAYMENT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${nibToken}`,
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error:
          responseData.message ||
          `Payment initiation failed (HTTP ${response.status}).`,
      };
    }

    // -----------------------------------------
    // 🔹 Update Bills w/ Transaction Ref
    // -----------------------------------------
    await databaseService.updateManyBills(
      { id: { in: billIds } },
      {
        tenantPaymentNotes: `Payment initiated with NIB. Ref: ${transactionId}`,
        paymentReference: signature,
      },
    );

    return {
      success: true,
      message: "Payment initiated successfully.",
      redirectUrl: responseData.redirectUrl,
      data: responseData,
    };
  } catch (error) {
    console.error("initiatePaymentAction error", error);
    return {
      success: false,
      error: "Unexpected error while initiating payment.",
    };
  }
}

// -------------------------
// 🔹 Get Bill Status
// -------------------------
export async function getBillStatusAction(
  billIds: string[],
  superAppToken?: string,
) {
  try {
    const currentUser = await getCurrentUser(superAppToken);
    if (!currentUser)
      return { status: "Error", error: "Authentication failed." };

    const bills = await databaseService.getAllBills({
      where: { id: { in: billIds } },
    });

    if (!bills.length) return { status: "Error", error: "Bills not found." };

    if (bills.some((b) => b.status === "Paid")) return { status: "Paid" };
    if (bills.every((b) => ["Pending", "Overdue"].includes(b.status)))
      return { status: "Pending" };

    return { status: "Mixed" };
  } catch (e: any) {
    return { status: "Error", error: e.message };
  }
}
