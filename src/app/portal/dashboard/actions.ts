

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

export async function submitPaymentProofAction(data: {
  billId: string;
  paymentProofUrl: string; // The client will provide this (e.g., a filename)
  notes?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "Authentication required." };
    }
    
    const bill = await prisma.bill.findUnique({
      where: { id: data.billId },
      include: { agreement: { include: { tenant: true } } }
    });

    if (!bill || bill.agreement?.tenant?.userId !== currentUser.id) {
      return { success: false, error: "Bill not found or you do not have permission to modify it." };
    }
    
    if (bill.status !== 'Pending' && bill.status !== 'Overdue') {
      return { success: false, error: `Cannot submit proof for a bill with status "${bill.status}".` };
    }

    await databaseService.updateBill(data.billId, {
      status: 'PendingVerification',
      paymentProofUrl: data.paymentProofUrl,
      tenantPaymentNotes: data.notes,
      paymentDate: new Date(), // Set payment date to when proof is submitted
    });
    
    revalidatePath('/portal/dashboard');
    revalidatePath('/admin/billing'); // Also revalidate admin page

    return { success: true };

  } catch (error: any) {
    console.error("Error submitting payment proof:", error);
    return { success: false, error: "Failed to submit payment proof." };
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
