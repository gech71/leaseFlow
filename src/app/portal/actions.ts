
"use server";

import { databaseService } from "@/lib/services/databaseService";
import type {
  Agreement as AgreementPrisma,
  User,
  Role,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/services/emailService";
import { verifySession } from '@/lib/auth/jwt';
import { revalidatePath } from 'next/cache';


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
