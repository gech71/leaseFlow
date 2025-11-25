
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
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/services/emailService";
import crypto from "crypto";
import { revalidatePath } from 'next/cache';
import { verifySession } from '@/lib/auth/jwt'; // Correctly import verifySession

// --- User Authentication Helper ---
// This function uses the project's custom JWT session verification.
async function getCurrentUser(): Promise<(User & { roles: Role[] }) | null> {
  const session = await verifySession();
  if (session?.userId) {
    const user = await databaseService.getUserById(session.userId, {
      roles: true,
    });
    if (user) return user;
  }
  return null;
}


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
                  amount: Number(item.amount), // Ensure number
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
              amount: Number(item.amount), // Ensure number
              id: typeof item.id === "string" ? item.id : undefined,
            }));
        }

        const { utilityBreakdown: _originalScalarUtilityData, ...billData } =
          rawBill;
        
        // Serialize Decimal and Date fields in the bill
        return { 
          ...billData, 
          utilityBreakdown: parsedItems,
          rentAmount: Number(billData.rentAmount),
          penaltyAmount: billData.penaltyAmount ? Number(billData.penaltyAmount) : null,
          totalAmount: Number(billData.totalAmount),
          billDate: billData.billDate.toISOString(),
          dueDate: billData.dueDate.toISOString(),
          createdAt: billData.createdAt.toISOString(),
          updatedAt: billData.updatedAt.toISOString(),
          paymentDate: billData.paymentDate ? billData.paymentDate.toISOString() : null,
        };
      });

      // Serialize Decimal and Date fields in the agreement and its relations
      return { 
          ...ag, 
          bills: processedBills,
          startDate: ag.startDate.toISOString(),
          createdAt: ag.createdAt.toISOString(),
          updatedAt: ag.updatedAt.toISOString(),
          nextPaymentDueDate: ag.nextPaymentDueDate.toISOString(),
          initialPaymentDate: ag.initialPaymentDate ? ag.initialPaymentDate.toISOString() : null,
          endDate: ag.endDate ? ag.endDate.toISOString() : null,
          monthlyRentalPrice: Number(ag.monthlyRentalPrice),
          initialPaymentAmount: ag.initialPaymentAmount ? Number(ag.initialPaymentAmount) : null,
          space: {
              ...ag.space,
              area: Number(ag.space.area),
              monthlyRentalPrice: Number(ag.space.monthlyRentalPrice),
              utilityProrationShare: Number(ag.space.utilityProrationShare),
              createdAt: ag.space.createdAt.toISOString(),
              updatedAt: ag.space.updatedAt.toISOString(),
              building: {
                ...ag.space.building,
                createdAt: ag.space.building.createdAt.toISOString(),
                updatedAt: ag.space.building.updatedAt.toISOString(),
                penaltyPolicyTiers: ag.space.building.penaltyPolicyTiers.map(tier => ({
                    ...tier,
                    feeValue: Number(tier.feeValue)
                }))
              }
          },
          tenant: {
            ...ag.tenant,
            createdAt: ag.tenant.createdAt.toISOString(),
            updatedAt: ag.tenant.updatedAt.toISOString(),
          }
      };
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
      agreements: activeAgreements as unknown as PortalAgreementWithRelations[],
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
  paymentProofDataUri: string; // Changed from paymentProofUrl to accept data URI
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
    
    // Check data URI size before saving
    if (data.paymentProofDataUri.length > 2 * 1024 * 1024) { // 2MB limit
      return { success: false, error: "The uploaded PDF file is too large. Please upload a file smaller than 2MB." };
    }

    await databaseService.updateBill(data.billId, {
      status: 'PendingVerification',
      paymentProofDataUri: data.paymentProofDataUri, // Save the data URI
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
