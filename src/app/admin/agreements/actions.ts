"use server";

import { revalidatePath } from "next/cache";
import { databaseService } from "@/lib/services/databaseService";
import { Prisma, type Agreement, AgreementStatus } from "@prisma/client";
import { addMonths, parseISO } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getUserAndPermissions } from "@/lib/actions/server-helpers";

export interface CreateFullAgreementData {
  // IDs for relations
  tenantId: string;
  spaceId: string;
  agreementTemplateId: string;

  // Details for the agreement itself, often from form + AI
  agreementText: string;
  startDate: string; // ISO String from client
  monthlyRentalPrice: number; // From selected space
  paymentTermMonths: number;
  initialPaymentMonths: number;
  additionalTerms?: string | null;
}

export async function createFullAgreementAction(
  input: CreateFullAgreementData,
) {
  try {
    // If the incoming start date is a date-only string (YYYY-MM-DD),
    // construct a UTC-midnight Date so storing it in the DB doesn't
    // shift it backward by the local timezone offset (e.g. 00:00 local
    // -> previous day 21:00 UTC). This ensures the first bill created
    // at agreement import has the same calendar date in the DB.
    let startDateObj: Date;
    const rawStart = String(input.startDate || "").trim();
    const dateOnlyMatch = /^\d{4}-\d{1,2}-\d{1,2}$/.test(rawStart);
    if (dateOnlyMatch) {
      const [y, m, d] = rawStart.split("-").map(Number);
      startDateObj = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    } else {
      startDateObj = parseISO(rawStart);
    }
    // Compute agreement end date and next due date based on initial prepaid months
    const endDateObj = addMonths(startDateObj, input.paymentTermMonths);
    const initialMonths = input.initialPaymentMonths || 0;
    // Always set next payment due date to the agreement start date so monthly
    // bills will be generated for every month (including initial prepaid
    // months, where rent may be zero). This prevents skipping months when the
    // system previously advanced the next due date past prepaid months.
    const nextPaymentDueDateObj = startDateObj;
    const initialPaymentAmount = input.monthlyRentalPrice * initialMonths;

    // Persist date-only strings (YYYY-MM-DD) to ensure the DB stores the
    // same calendar date regardless of timezone or column type.
    const toDateOnlyString = (d: Date) => {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };
    const startDateForDb = toDateOnlyString(startDateObj);
    const nextPaymentDueForDb = toDateOnlyString(nextPaymentDueDateObj);
    const initialPaymentDateForDb = toDateOnlyString(startDateObj);
    const endDateForDb = toDateOnlyString(endDateObj);

    // Prisma expects a Date object or full ISO-8601 date-time string for DateTime
    // fields. Construct Date objects at UTC-midnight so the stored calendar
    // date is consistent regardless of server TZ.
    const toUtcMidnight = (d: Date) =>
      new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0),
      );
    const startDateForDbDate = toUtcMidnight(startDateObj);
    const nextPaymentDueForDbDate = toUtcMidnight(nextPaymentDueDateObj);
    const initialPaymentDateForDbDate = toUtcMidnight(startDateObj);
    const endDateForDbDate = toUtcMidnight(endDateObj);

    const newAgreementId = await prisma.$transaction(async (tx) => {
      // 1. Create the Agreement
      const agreement = await tx.agreement.create({
        data: {
          agreementText: input.agreementText,
          startDate: startDateForDbDate,
          monthlyRentalPrice: input.monthlyRentalPrice,
          paymentTermMonths: input.paymentTermMonths,
          initialPaymentMonths: input.initialPaymentMonths,
          nextPaymentDueDate: nextPaymentDueForDbDate,
          endDate: endDateForDbDate,
          additionalTerms: input.additionalTerms,
          status: "Active", // Set initial status to Active

          initialPaymentAmount: initialPaymentAmount,
          initialPaymentDate: initialPaymentDateForDbDate,

          tenant: { connect: { id: input.tenantId } },
          space: { connect: { id: input.spaceId } },
          agreementTemplate: { connect: { id: input.agreementTemplateId } },
        },
      });

      // 2. If there are initial prepaid months, create a single aggregated
      // bill at agreement creation that covers `initialPaymentMonths`.
      // Subsequent monthly bills will still be generated each month; for
      // months covered by the prepaid amount the monthly rent portion will
      // be zero so utilities/penalties can still apply.
      const monthlyAmount = input.monthlyRentalPrice;
      const initialMonthsForCreation = initialMonths;

      if (initialMonthsForCreation > 0) {
        const initialAmount = monthlyAmount * initialMonthsForCreation;
        await tx.bill.create({
          data: {
            agreementId: agreement.id,
            tenantId: input.tenantId,
            billDate: startDateForDbDate,
            dueDate: startDateForDbDate,
            rentAmount: initialAmount,
            utilityBreakdown: Prisma.JsonNull,
            penaltyAmount: 0,
            totalAmount: initialAmount,
            status: "Pending",
            paymentDate: null,
            paymentMethod: null,
            paymentReference: null,
            adminVerifiedPayment: false,
            isPrepaid: true,
          },
        });
      }

      // 3. Update space to be occupied by this tenant
      await tx.space.update({
        where: { id: input.spaceId },
        data: {
          isOccupied: true,
        },
      });

      // 4. Update tenant's rentedSpaceId
      await tx.tenant.update({
        where: { id: input.tenantId },
        data: {
          rentedSpace: { connect: { id: input.spaceId } },
        },
      });

      return agreement.id;
    });

    // Re-fetch the agreement with all relations to ensure the returned object is complete
    const completeNewAgreement = await databaseService.getAgreementById(
      newAgreementId,
      {
        tenant: true,
        space: true,
      },
    );

    if (!completeNewAgreement) {
      throw new Error("Failed to re-fetch the newly created agreement.");
    }

    revalidatePath("/admin/agreements");
    revalidatePath("/admin/spaces"); // Space occupancy changed
    revalidatePath("/admin/tenants"); // Tenant's rentedSpace changed
    revalidatePath("/admin/billing"); // Invalidate billing page data

    // Convert Decimal fields to numbers before returning
    const serializableAgreement = {
      ...completeNewAgreement,
      monthlyRentalPrice: Number(completeNewAgreement.monthlyRentalPrice),
      initialPaymentAmount: completeNewAgreement.initialPaymentAmount
        ? Number(completeNewAgreement.initialPaymentAmount)
        : null,
    };

    return { success: true, agreement: serializableAgreement };
  } catch (error: any) {
    console.error("Error creating agreement:", error);
    let errorMessage = "Failed to create agreement.";
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        errorMessage =
          "Failed to create agreement. A similar agreement might already exist or related data conflict (e.g. space already linked).";
      } else if (error.code === "P2025") {
        errorMessage =
          "Failed to create agreement. Tenant, Space, or Template not found.";
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    return { success: false, error: errorMessage };
  }
}

export async function cancelAgreementAction(
  agreementId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { isSuperAdmin, permissions } = await getUserAndPermissions();
    if (!isSuperAdmin && !permissions.has("agreement:edit")) {
      // Using 'edit' as a proxy for cancellation
      return { success: false, error: "Access Denied" };
    }

    const agreement = await databaseService.getAgreementById(agreementId);
    if (!agreement) {
      return { success: false, error: "Agreement not found." };
    }

    if (agreement.status === "Canceled") {
      return {
        success: false,
        error: "This agreement has already been canceled.",
      };
    }

    await prisma.$transaction(async (tx) => {
      // 1. Update the agreement status to 'Canceled'
      await tx.agreement.update({
        where: { id: agreementId },
        data: { status: "Canceled" },
      });

      // 2. Free up the space
      if (agreement.spaceId) {
        await tx.space.update({
          where: { id: agreement.spaceId },
          data: { isOccupied: false },
        });
      }

      // 3. Disconnect tenant from the space
      if (agreement.tenantId) {
        await tx.tenant.update({
          where: { id: agreement.tenantId },
          data: { rentedSpaceId: null },
        });
      }

      // 4. Delete all non-paid bills for this agreement
      await tx.bill.deleteMany({
        where: {
          agreementId: agreementId,
          status: { not: "Paid" },
        },
      });
    });

    revalidatePath("/admin/agreements");
    revalidatePath("/admin/spaces");
    revalidatePath("/admin/tenants");
    revalidatePath("/admin/billing");
    revalidatePath("/admin/dashboard");

    return { success: true };
  } catch (error: any) {
    console.error("Error cancelling agreement:", error);
    return {
      success: false,
      error: error.message || "Failed to cancel agreement.",
    };
  }
}
