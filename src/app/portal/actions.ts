
"use server";

import { databaseService } from "@/lib/services/databaseService";
import type {
  User,
  Role,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/services/emailService";
import { verifySession, createSession, ACCESS_TOKEN_COOKIE_NAME } from '@/lib/auth/jwt';
import { revalidatePath } from 'next/cache';
import { nanoid } from "nanoid";
import { cookies } from 'next/headers';
import type { PortalAgreementWithRelations } from './dashboard/actions';


// --- User Authentication Helper ---
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

export async function setPortalSessionAction(token: string) {
  try {
    const payload = {
      portalToken: token,
      userId: `portal-user-${nanoid(8)}`, // Create a temporary unique ID
      email: 'portal-user@example.com',
      isSuperAdmin: false,
      permissions: ['portal:view'],
      forceChangePass: false,
      iat: Math.floor(Date.now() / 1000), // Use numeric timestamp for 'issued at'
    };
    
    const { accessToken, refreshToken } = await createSession(payload);

    cookies().set(accessToken.name, accessToken.value, accessToken.options);
    cookies().set(refreshToken.name, refreshToken.value, refreshToken.options);

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
