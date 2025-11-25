
"use server";

import { databaseService } from "@/lib/services/databaseService";
import type {
  Agreement as AgreementPrisma,
  User,
  Role,
  Prisma,
  Building,
  Space,
  Tenant,
  Bill,
  BuildingMonthlyUtilities,
  PenaltyTier,
  AgreementTemplate,
  ArifPayment
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/services/emailService";
import { verifySession, createSession } from '@/lib/auth/jwt';
import { revalidatePath } from 'next/cache';
import { nanoid } from "nanoid";
import { redirect } from 'next/navigation';
import type { PortalAgreementWithRelations } from './dashboard/actions';


// --- User Authentication Helper ---
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

export async function setPortalSessionAction(token: string) {
  try {
    const payload = {
      portalToken: token,
      userId: `portal-user-${nanoid(8)}`, // Create a temporary unique ID
      email: 'portal-user@example.com',
      isSuperAdmin: false,
      permissions: ['portal:view'],
      forceChangePass: false,
    };
    await createSession(payload);
    return { success: true };
  } catch (error) {
    console.error("Error creating portal session:", error);
    return { success: false, error: "Failed to create session." };
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
      // If no manager assigned, find SUPER_ADMINs as a fallback
      const superAdmins = await prisma.user.findMany({
        where: { roles: { some: { name: 'SUPER_ADMIN' } } }
      });
      
      if (superAdmins.length === 0) {
        return {
          success: false,
          error: "No manager or admin is assigned to your building. Cannot send email.",
        };
      }

      const adminEmails = superAdmins.map(a => a.email).filter((email): email is string => !!email);
      
      if (adminEmails.length === 0) {
         return {
          success: false,
          error: "No administrators have a configured email address.",
        };
      }
      
      const emailHtml = `
        <h1>Contact Form Submission from Tenant Portal</h1>
        <p><strong>From Tenant:</strong> ${tenant.name} (${tenant.email})</p>
        <p><strong>Building:</strong> ${agreement?.space?.building.name || 'N/A'}</p>
        <p><strong>Space:</strong> ${agreement?.space?.spaceIdName || 'N/A'}</p>
        <hr>
        <h2>Subject: ${formData.subject}</h2>
        <p>${formData.body.replace(/\n/g, "<br>")}</p>
      `;

      await sendEmail({
        to: adminEmails.join(", "),
        subject: `[Tenant Portal Contact] ${formData.subject}`,
        html: emailHtml,
      });

    } else {
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

        await sendEmail({
          to: managerEmails.join(", "),
          subject: `[Tenant Portal] ${formData.subject}`,
          html: emailHtml,
        });
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

export async function getAgreementDetailsForPortalAction(agreementId: string): Promise<{
    agreement: PortalAgreementWithRelations | null;
    error?: string;
}> {
    try {
        const currentUser = await getCurrentUser();
        if (!currentUser) {
            return { agreement: null, error: "Authentication required." };
        }

        const agreement = await databaseService.getAgreementById(agreementId, {
            tenant: true,
            space: {
                include: {
                    building: {
                        include: {
                            penaltyPolicyTiers: true,
                            managers: true,
                        },
                    },
                },
            },
            bills: { orderBy: { billDate: 'desc' } },
        });

        if (!agreement) {
            return { agreement: null, error: "Agreement not found." };
        }

        // Security check: ensure the tenant associated with the agreement is the current user.
        if (agreement.tenant?.userId !== currentUser.id) {
            return { agreement: null, error: "You do not have permission to view this agreement." };
        }

        // Serialize the agreement data to be client-safe
        const serializedAgreement = {
            ...agreement,
            startDate: agreement.startDate.toISOString(),
            createdAt: agreement.createdAt.toISOString(),
            updatedAt: agreement.updatedAt.toISOString(),
            nextPaymentDueDate: agreement.nextPaymentDueDate.toISOString(),
            initialPaymentDate: agreement.initialPaymentDate ? agreement.initialPaymentDate.toISOString() : null,
            endDate: agreement.endDate ? agreement.endDate.toISOString() : null,
            monthlyRentalPrice: Number(agreement.monthlyRentalPrice),
            initialPaymentAmount: agreement.initialPaymentAmount ? Number(agreement.initialPaymentAmount) : null,
            space: {
                ...agreement.space!,
                area: Number(agreement.space!.area),
                monthlyRentalPrice: Number(agreement.space!.monthlyRentalPrice),
                utilityProrationShare: Number(agreement.space!.utilityProrationShare),
                createdAt: agreement.space!.createdAt.toISOString(),
                updatedAt: agreement.space!.updatedAt.toISOString(),
                building: {
                    ...agreement.space!.building,
                    createdAt: agreement.space!.building.createdAt.toISOString(),
                    updatedAt: agreement.space!.building.updatedAt.toISOString(),
                    penaltyPolicyTiers: agreement.space!.building.penaltyPolicyTiers.map(tier => ({
                        ...tier,
                        feeValue: Number(tier.feeValue)
                    })),
                }
            },
            tenant: {
                ...agreement.tenant!,
                createdAt: agreement.tenant!.createdAt.toISOString(),
                updatedAt: agreement.tenant!.updatedAt.toISOString(),
            },
            bills: agreement.bills.map(bill => {
                let parsedItems: any[] = [];
                if (typeof (bill as any).utilityBreakdown === 'string') {
                    try { parsedItems = JSON.parse((bill as any).utilityBreakdown); } catch (e) {}
                } else if (Array.isArray((bill as any).utilityBreakdown)) {
                    parsedItems = (bill as any).utilityBreakdown;
                }
                return {
                    ...bill,
                    utilityBreakdown: parsedItems,
                    rentAmount: Number(bill.rentAmount),
                    penaltyAmount: bill.penaltyAmount ? Number(bill.penaltyAmount) : null,
                    totalAmount: Number(bill.totalAmount),
                    billDate: bill.billDate.toISOString(),
                    dueDate: bill.dueDate.toISOString(),
                    createdAt: bill.createdAt.toISOString(),
                    updatedAt: bill.updatedAt.toISOString(),
                    paymentDate: bill.paymentDate ? bill.paymentDate.toISOString() : null,
                };
            }),
        };

        return { agreement: serializedAgreement as unknown as PortalAgreementWithRelations };
        
    } catch (error: any) {
        console.error("Error fetching agreement details for portal:", error);
        return { agreement: null, error: `An unexpected error occurred: ${error.message}` };
    }
}
