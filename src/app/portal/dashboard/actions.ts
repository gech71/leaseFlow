

// src/app/portal/dashboard/actions.ts
"use server";

import { databaseService } from "@/lib/services/databaseService";
import type {
  Agreement as AgreementPrisma,
  Bill as BillPrisma,
  Space as SpacePrisma,
  Building as BuildingPrisma,
  Tenant as TenantPrisma,
  PenaltyTier as PenaltyTierPrisma,
  User,
  Role,
} from "@prisma/client";
import { addMonths, isAfter, format } from "date-fns";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/services/emailService";
import crypto from "crypto";

// --- Normalization Helper ---
// Corrected to handle PascalCase keys like 'URL' without mangling them.
const toCamelCase = (s: string) => {
  if (typeof s !== 'string' || s.length === 0) {
    return s;
  }
  // This handles snake_case and ensures PascalCase like 'ResponseCode' becomes 'responseCode'
  // but doesn't affect all-caps acronyms like 'URL'.
  return s.replace(/_([a-z])/g, (g) => g[1].toUpperCase())
         .replace(/^[A-Z](?![A-Z]|$)/, (L) => L.toLowerCase());
};


const isObject = function (o: any) {
  return o === Object(o) && !Array.isArray(o) && typeof o !== "function";
};

const normalizeKeys = (obj: any): any => {
  if (isObject(obj)) {
    const n: { [key: string]: any } = {};
    Object.keys(obj).forEach((k) => {
      n[toCamelCase(k)] = normalizeKeys(obj[k]);
    });
    return n;
  } else if (Array.isArray(obj)) {
    return obj.map((i) => {
      return normalizeKeys(i);
    });
  }
  return obj;
};
// --- End Normalization Helper ---

// Define a simple structure for parsed utility items
interface ParsedUtilityItemForAction {
  id?: string;
  name: string;
  amount: number;
}

// Types that match the structure of data fetched with Prisma, including relations
export type PortalAgreementWithRelations = Omit<AgreementPrisma, "bills"> & {
  space: SpacePrisma & {
    building: BuildingPrisma & {
      penaltyPolicyTiers: PenaltyTierPrisma[];
      managers: User[]; // <-- Ensure managers are included
    };
  };
  tenant: TenantPrisma;
  bills: (Omit<BillPrisma, "utilityBreakdown"> & {
    utilityBreakdown: ParsedUtilityItemForAction[];
  })[];
};

export interface TenantPortalData {
  agreements: PortalAgreementWithRelations[]; // Changed to an array
  error?: string;
}

// --- User Authentication Helpers ---
const ACCESS_TOKEN_KEY = "nibrental_admin_access_token";

// Insecure JWT payload decoder
async function decodeJwtPayload(token: string): Promise<any | null> {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map(function (c) {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join(""),
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error("Portal Auth Error: Failed to decode JWT payload:", e);
    return null;
  }
}

// Gets current user from the session cookie
async function getCurrentUser(): Promise<(User & { roles: Role[] }) | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_KEY)?.value; 

  if (!accessToken) {
    console.error(
      "Portal Auth Error: No session access token found in cookie.",
    );
    return null;
  }

  const tokenPayload = await decodeJwtPayload(accessToken);
  if (!tokenPayload || !tokenPayload.sub) {
    console.error(
      `Portal Auth Error: Failed to decode session token or 'sub' claim is missing.`,
    );
    return null;
  }

  const user = await databaseService.getUserByExternalId(tokenPayload.sub, {
    roles: true,
  });

  if (!user) {
    console.error(
      `Portal Auth Error: User with external ID (sub) '${tokenPayload.sub}' not found in the local system.`,
    );
  }

  return user;
}

export async function getTenantPortalDashboardDataAction(): Promise<TenantPortalData> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return {
        agreements: [],
        error:
          "Your session is invalid or has expired. Please re-enter from the Mini App or login page.",
      };
    }

    // Find the tenant record associated with the logged-in user's email or phone number
    const associatedTenant = await databaseService.findTenantByEmailOrPhone(
      currentUser.email,
      currentUser.phoneNumber,
    );

    if (!associatedTenant) {
      console.error(
        `Portal Data Error: User '${currentUser.email}' is authenticated but not associated with any tenant record.`,
      );
      return {
        agreements: [],
        error:
          "Your user account is not associated with any tenant profile. Please contact property management.",
      };
    }

    const allAgreementsRaw = await databaseService.getAllAgreements({
      where: { tenantId: associatedTenant.id },
      include: {
        tenant: true,
        space: {
          include: {
            building: {
              include: {
                penaltyPolicyTiers: true,
                managers: true, // Fetch managers
              },
            },
          },
        },
        bills: {
          orderBy: { billDate: "desc" },
        },
        disabledAgreements: { // Fetch the disabled status
            select: {
                disabledById: true
            }
        }
      },
      orderBy: { createdAt: "asc" },
    });

    // Filter out disabled agreements before processing
    const enabledAgreements = allAgreementsRaw.filter(ag => ag.disabledAgreements.length === 0);

    const processedAgreements = enabledAgreements.map((ag) => {
      const processedBills = ag.bills.map((rawBill) => {
        let parsedItems: ParsedUtilityItemForAction[] = [];
        const rawUtilityData = (rawBill as any).utilityBreakdown;

        if (typeof rawUtilityData === "string") {
          try {
            const jsonData = JSON.parse(rawUtilityData);
            if (Array.isArray(jsonData)) {
              parsedItems = jsonData
                .filter(
                  (item) =>
                    typeof item.name === "string" &&
                    typeof item.amount === "number",
                )
                .map((item) => ({
                  name: item.name,
                  amount: item.amount,
                  id: typeof item.id === "string" ? item.id : undefined,
                }));
            }
          } catch (e) {
            console.error(
              `Portal Action: Failed to parse utilityBreakdown JSON for bill ${rawBill.id}:`,
              e,
            );
          }
        } else if (Array.isArray(rawUtilityData)) {
          parsedItems = rawUtilityData
            .filter(
              (item) =>
                typeof item.name === "string" &&
                typeof item.amount === "number",
            )
            .map((item) => ({
              name: item.name,
              amount: item.amount,
              id: typeof item.id === "string" ? item.id : undefined,
            }));
        }

        const { utilityBreakdown: _originalScalarUtilityData, ...billData } =
          rawBill;
        return { ...billData, utilityBreakdown: parsedItems };
      });
      return { ...ag, bills: processedBills };
    });

    const activeAgreements = processedAgreements.filter(ag => {
        const agreementEndDate = addMonths(new Date(ag.startDate), ag.paymentTermMonths);
        return isAfter(agreementEndDate, new Date());
    });

    if (activeAgreements.length === 0) {
        return {
            agreements: [],
            error: "You do not have any active agreements."
        }
    }


    return {
      agreements: activeAgreements as PortalAgreementWithRelations[],
      error: undefined,
    };
  } catch (error: any) {
    console.error("Error fetching tenant portal data:", error);
    return {
      agreements: [],
      error: `Failed to fetch portal data: ${(error as Error).message}`,
    };
  }
}

export async function initiateArifpayPaymentAction(
  billId: string,
  billAmount: number,
  billDate: string,
): Promise<{ success: boolean; error?: string; paymentUrl?: string }> {
  const ARIFPAY_API_URL = process.env.ARIFPAY_API_URL;
  const ARIFPAY_API_KEY = process.env.ARIFPAY_API_KEY;

  if (!ARIFPAY_API_URL || !ARIFPAY_API_KEY) {
    console.error("ArifPay environment variables are not configured.");
    return {
      success: false,
      error: "Payment service is not configured correctly.",
    };
  }

  try {
    const currentUser = await getCurrentUser();
    if (!currentUser?.phoneNumber || !currentUser?.email) {
      return {
        success: false,
        error: "Your user profile is missing a phone number or email address.",
      };
    }

    const bill = await prisma.bill.findUnique({
      where: { id: billId },
      include: {
        agreement: { include: { space: { include: { building: true } } } },
      },
    });

    if (!bill) {
      return { success: false, error: "Bill not found." };
    }
    if (!bill.agreement?.space?.building?.accountNumber) {
      return {
        success: false,
        error: "Building account number is not configured for this bill.",
      };
    }

    let arifpayPhoneNumber = currentUser.phoneNumber;
    if (arifpayPhoneNumber.startsWith("09")) {
      arifpayPhoneNumber = "2519" + arifpayPhoneNumber.substring(2);
    } else if (arifpayPhoneNumber.startsWith("07")) {
      arifpayPhoneNumber = "2517" + arifpayPhoneNumber.substring(2);
    }

    const requestBody = {
      phone: arifpayPhoneNumber,
      cbs: bill.agreement.space.building.accountNumber,
      email: currentUser.email,
      items: [
        {
          name: `Bill payment for ${format(new Date(billDate), "yyyy-MM-dd")}`,
          quantity: 1,
          price: billAmount,
          description: `Bill payment for date: ${billDate}`,
        },
      ],
    };

    console.log("ArifPay Request Body:", requestBody);

    const response = await fetch(`${ARIFPAY_API_URL}/createsession`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "API-Key": ARIFPAY_API_KEY,
      },
      body: JSON.stringify(requestBody),
    });

    console.log("ArifPay Response Status:", response.status);

    const responseText = await response.text();
    if (!responseText) {
      console.error(
        "ArifPay API Error: Received an empty response from the server.",
      );
      return {
        success: false,
        error: "Payment gateway returned an empty response.",
      };
    }

    console.log("ArifPay Response Body:", responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      console.error(
        "ArifPay API Error: Failed to parse JSON response. Body:",
        responseText,
      );
      return {
        success: false,
        error: "Payment gateway returned an invalid response.",
      };
    }

    if (responseData.ResponseCode && responseData.ResponseCode !== "0") {
      console.error("ArifPay API Error:", responseData);
      return {
        success: false,
        error: `Payment gateway error: ${
          responseData.ResponseDescription || "An unknown error occurred."
        }`,
      };
    }
    
    // Direct access to the response data without normalization
    const paymentUrl = responseData?.Data?.URL;
    const sessionId = responseData?.Data?.NA;
    
    if (!paymentUrl || !sessionId) {
      console.error("ArifPay API Error - No URL or Session ID:", responseData);
      return {
        success: false,
        error:
          "Payment gateway did not return a valid payment URL or session ID.",
      };
    }

    await prisma.$transaction(async (tx) => {
      // Create the ArifPayment record
      await tx.arifPayment.create({
        data: {
          sessionId: sessionId,
          status: "Pending",
          amount: billAmount,
          paymentUrl: paymentUrl,
          bill: { connect: { id: billId } },
        },
      });

      // Update the bill status
      await tx.bill.update({
        where: { id: billId },
        data: { status: "Pending" }, // Set to pending, callback will set to Paid
      });
    });

    return { success: true, paymentUrl: paymentUrl };
  } catch (error: any) {
    console.error("Error in initiateArifpayPaymentAction:", error);
    return {
      success: false,
      error: "An unexpected error occurred while initiating payment.",
    };
  }
}

export async function sendContactEmailAction(formData: {
  subject: string;
  body: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "Authentication required." };
    }

    const tenant = await databaseService.findTenantByEmailOrPhone(
      currentUser.email,
      currentUser.phoneNumber,
    );
    if (!tenant) {
      return {
        success: false,
        error: "No tenant profile associated with your user account.",
      };
    }

    const agreement = await prisma.agreement.findFirst({
      where: { tenantId: tenant.id },
      include: {
        space: { include: { building: { include: { managers: true } } } },
      },
      orderBy: { startDate: "desc" },
    });

    if (
      !agreement?.space?.building?.managers ||
      agreement.space.building.managers.length === 0
    ) {
      return {
        success: false,
        error: "No manager is assigned to your building. Cannot send email.",
      };
    }

    const managerEmails = agreement.space.building.managers
      .map((m) => m.email)
      .filter((email): email is string => !!email);

    if (managerEmails.length === 0) {
      return {
        success: false,
        error: "Building manager(s) do not have an email address configured.",
      };
    }

    const emailHtml = `
      <h1>Contact Form Submission from Tenant Portal</h1>
      <p><strong>From Tenant:</strong> ${tenant.name} (${tenant.email})</p>
      <p><strong>Building:</strong> ${agreement.space.building.name}</p>
      <p><strong>Space:</strong> ${agreement.space.spaceIdName}</p>
      <hr>
      <h2>Subject: ${formData.subject}</h2>
      <p>${formData.body.replace(/\n/g, "<br>")}</p>
    `;

    const result = await sendEmail({
      from: `"${tenant.name}" <${tenant.email}>`,
      to: managerEmails.join(", "),
      subject: `[Tenant Portal] ${formData.subject}`,
      html: emailHtml,
    });

    if (!result.success) {
      throw new Error(result.error || "Email service failed.");
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error in sendContactEmailAction:", error);
    return {
      success: false,
      error: `Failed to send message: ${error.message}`,
    };
  }
}
