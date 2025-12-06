"use server";

import { revalidatePath } from "next/cache";
import { databaseService } from "@/lib/services/databaseService";
import { createTenantAction } from "../tenants/actions";
import { createFullAgreementAction } from "../agreements/actions";
import {
  getUserAndPermissions,
  getUserAndManagedIds,
} from "@/lib/actions/server-helpers";
import type { Prisma } from "@prisma/client";
import { addMonths } from "date-fns";

const MAX_ROWS_PER_SHEET = 2000; // Server-side limit

export async function getAgreementTemplatesForImportAction(): Promise<
  { id: string; name: string }[]
> {
  const { isSuperAdmin, currentUser, permissions } =
    await getUserAndPermissions();

  if (!isSuperAdmin && !permissions.has("import:manage")) {
    return [];
  }

  // Templates are not scoped to a building in the schema, and import
  // operators commonly need access to templates created by others in the
  // organization. Return all templates for users with the import permission.
  const { managedBuildingIds } = await getUserAndManagedIds();

  // For non-superadmins allow templates that were created by the current
  // user or are tied to buildings they manage; creators should be able to
  // select their own templates during import even if not tied to a
  // managed building.
  const where: Prisma.AgreementTemplateWhereInput = isSuperAdmin
    ? {}
    : {
        OR: [
          { createdById: currentUser.id },
          { buildingId: { in: managedBuildingIds ?? [] } },
        ],
      };

  const templates = await databaseService.getAllAgreementTemplates({
    where,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return templates.map((t) => ({ id: t.id, name: t.name }));
}

interface ImportData {
  spaces: any[];
  tenants: any[];
  agreements: any[];
  agreementTemplateId: string;
}

const normalizePhoneNumber = (phone: any): string | undefined => {
  if (!phone) return undefined;
  let phoneStr = String(phone).trim();
  if (phoneStr.length === 9 && !phoneStr.startsWith("0")) {
    return `0${phoneStr}`;
  }
  return phoneStr;
};

const sanitizeString = (value: any): string =>
  value ? String(value).trim() : "";

const sanitizeNumber = (value: any): number => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return NaN;
  }
  const num = Number(value);
  return num;
};

const isValidEmail = (email: string): boolean => {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Define the exact expected keys for each sheet
const EXPECTED_SPACE_KEYS = new Set([
  "buildingName",
  "spaceIdName",
  "floor",
  "area",
  "monthlyRentalPrice",
  "prorationShare",
]);
const EXPECTED_TENANT_KEYS = new Set([
  "name",
  "email",
  "phone",
  "alternativePhone (Optional)",
  "nationalId",
  "representativeName (Optional)",
  "representativePhone (Optional)",
]);
const EXPECTED_AGREEMENT_KEYS = new Set([
  "tenantEmail",
  "buildingName",
  "spaceIdName",
  "startDate",
  "termMonths",
  "initialPaymentMonths",
  "additionalTerms (Optional)",
]);

export async function processImportAction(data: ImportData) {
  const { isSuperAdmin, permissions, currentUser } =
    await getUserAndPermissions();
  if (!isSuperAdmin && !permissions.has("import:manage")) {
    return {
      success: false,
      createdCount: { spaces: 0, tenants: 0, agreements: 0 },
      skippedCount: { spaces: 0, tenants: 0, agreements: 0 },
      errors: ["Permission denied."],
    };
  }

  const { managedBuildingIds } = await getUserAndManagedIds();

  // Server-side row limit validation
  if (
    data.spaces.length > MAX_ROWS_PER_SHEET ||
    data.tenants.length > MAX_ROWS_PER_SHEET ||
    data.agreements.length > MAX_ROWS_PER_SHEET
  ) {
    return {
      success: false,
      createdCount: { spaces: 0, tenants: 0, agreements: 0 },
      skippedCount: { spaces: 0, tenants: 0, agreements: 0 },
      errors: [
        `Import failed. The number of rows in one or more sheets exceeds the server limit of ${MAX_ROWS_PER_SHEET}.`,
      ],
    };
  }

  let createdCount = { spaces: 0, tenants: 0, agreements: 0 };
  let skippedCount = { spaces: 0, tenants: 0, agreements: 0 };
  let errors: string[] = [];

  const agreementTemplate = await databaseService.getAgreementTemplateById(
    data.agreementTemplateId,
  );
  if (!agreementTemplate) {
    errors.push("The selected agreement template could not be found.");
    return { success: false, createdCount, skippedCount, errors };
  }

  // Enforce that non-superadmin users may only use templates that are global,
  // belong to one of their managed buildings, or are created by themselves.
  if (!isSuperAdmin) {
    const allowed =
      agreementTemplate.buildingId === null ||
      agreementTemplate.createdById === currentUser.id ||
      (managedBuildingIds &&
        managedBuildingIds.includes(agreementTemplate.buildingId as string));
    if (!allowed) {
      errors.push("Access Denied");
      return { success: false, createdCount, skippedCount, errors };
    }
  }

  // --- 1. Process Spaces ---
  for (const [index, rawSpace] of data.spaces.entries()) {
    const row = index + 2;
    try {
      // Validate keys for the current row
      for (const key in rawSpace) {
        if (!EXPECTED_SPACE_KEYS.has(key)) {
          throw new Error(`Unexpected column "${key}" found.`);
        }
      }

      const space = {
        buildingName: sanitizeString(rawSpace.buildingName),
        spaceIdName: sanitizeString(rawSpace.spaceIdName),
        floor: sanitizeString(rawSpace.floor),
        area: sanitizeNumber(rawSpace.area),
        monthlyRentalPrice: sanitizeNumber(rawSpace.monthlyRentalPrice),
        utilityProrationShare: sanitizeNumber(rawSpace.prorationShare),
      };

      if (!space.buildingName || !space.spaceIdName) {
        errors.push(
          `Space Row ${row}: 'buildingName' and 'spaceIdName' are required.`,
        );
        skippedCount.spaces++;
        continue;
      }
      if (
        isNaN(space.area) ||
        isNaN(space.monthlyRentalPrice) ||
        isNaN(space.utilityProrationShare)
      ) {
        errors.push(
          `Space Row ${row} (${space.spaceIdName}): One or more numerical fields (area, price, proration) are invalid.`,
        );
        skippedCount.spaces++;
        continue;
      }

      const buildingForSpace = await databaseService.getAllBuildings({
        where: { name: space.buildingName },
        take: 1,
      });
      if (buildingForSpace.length > 0) {
        if (buildingForSpace[0].status !== "Active") {
          errors.push(
            `Space Row ${row} (${space.spaceIdName}): Cannot import space into inactive building "${space.buildingName}".`,
          );
          skippedCount.spaces++;
          continue;
        }

        const existingSpace = await databaseService.getAllSpaces({
          where: {
            buildingId: buildingForSpace[0].id,
            spaceIdName: space.spaceIdName,
          },
          take: 1,
        });
        if (existingSpace.length === 0) {
          await databaseService.createSpace({
            building: { connect: { id: buildingForSpace[0].id } },
            buildingName: space.buildingName,
            spaceIdName: space.spaceIdName,
            floor: space.floor,
            area: space.area,
            monthlyRentalPrice: space.monthlyRentalPrice,
            utilityProrationShare: space.utilityProrationShare / 100,
          });
          createdCount.spaces++;
        } else {
          skippedCount.spaces++;
        }
      } else {
        errors.push(
          `Space Row ${row} (${space.spaceIdName}): Building "${space.buildingName}" not found.`,
        );
        skippedCount.spaces++;
      }
    } catch (e: any) {
      errors.push(
        `Space Row ${row} (${rawSpace.spaceIdName || "N/A"}): ${e.message}`,
      );
      skippedCount.spaces++;
    }
  }

  // --- 2. Process Tenants ---
  for (const [index, rawTenant] of data.tenants.entries()) {
    const row = index + 2;
    try {
      for (const key in rawTenant) {
        if (!EXPECTED_TENANT_KEYS.has(key)) {
          throw new Error(`Unexpected column "${key}" found.`);
        }
      }

      const tenant = {
        name: sanitizeString(rawTenant.name),
        email: sanitizeString(rawTenant.email),
        phone: normalizePhoneNumber(rawTenant.phone),
        alternativePhone: normalizePhoneNumber(
          rawTenant["alternativePhone (Optional)"],
        ),
        nationalId: sanitizeString(rawTenant.nationalId),
        representativeName: sanitizeString(
          rawTenant["representativeName (Optional)"],
        ),
        representativePhone: normalizePhoneNumber(
          rawTenant["representativePhone (Optional)"],
        ),
      };

      if (!tenant.phone) {
        errors.push(
          `Tenant Row ${row} (${
            tenant.name || "N/A"
          }): Missing or invalid primary phone number.`,
        );
        skippedCount.tenants++;
        continue;
      }
      if (!tenant.email || !isValidEmail(tenant.email)) {
        errors.push(
          `Tenant Row ${row} (${tenant.name || "N/A"}): Email "${
            tenant.email
          }" is not a valid format.`,
        );
        skippedCount.tenants++;
        continue;
      }

      const existingTenant = await databaseService.findTenantByEmailOrPhone(
        tenant.email,
        tenant.phone,
      );
      if (!existingTenant) {
        const tenantData = {
          name: tenant.name,
          email: tenant.email,
          phone: tenant.phone,
          alternativePhone: tenant.alternativePhone,
          nationalId: tenant.nationalId || undefined,
          representativeName: tenant.representativeName || undefined,
          representativePhone: tenant.representativePhone,
        };

        const result = await createTenantAction(tenantData);
        if (result.success) {
          createdCount.tenants++;
        } else {
          if (result.error?.includes("already exists")) {
            errors.push(
              `Tenant Row ${row} (${tenant.name}): Skipped. A tenant with this email/phone likely exists or was just created.`,
            );
            skippedCount.tenants++;
          } else {
            errors.push(`Tenant Row ${row} (${tenant.name}): ${result.error}`);
            skippedCount.tenants++;
          }
        }
      } else {
        skippedCount.tenants++;
      }
    } catch (e: any) {
      errors.push(
        `Tenant Row ${row} (${rawTenant.name || "N/A"}): ${e.message}`,
      );
      skippedCount.tenants++;
    }
  }

  // --- 3. Process Agreements ---
  for (const [index, rawAgreement] of data.agreements.entries()) {
    const row = index + 2;
    try {
      for (const key in rawAgreement) {
        if (!EXPECTED_AGREEMENT_KEYS.has(key)) {
          throw new Error(`Unexpected column "${key}" found.`);
        }
      }

      const agreement = {
        tenantEmail: sanitizeString(rawAgreement.tenantEmail),
        buildingName: sanitizeString(rawAgreement.buildingName),
        spaceIdName: sanitizeString(rawAgreement.spaceIdName),
        startDate: sanitizeString(rawAgreement.startDate),
        termMonths: sanitizeNumber(rawAgreement.termMonths),
        initialPaymentMonths: sanitizeNumber(rawAgreement.initialPaymentMonths),
        additionalTerms: sanitizeString(
          rawAgreement["additionalTerms (Optional)"],
        ),
      };

      const startDate = new Date(agreement.startDate);
      if (isNaN(startDate.getTime())) {
        errors.push(
          `Agreement Row ${row}: Invalid start date "${agreement.startDate}" for tenant "${agreement.tenantEmail}".`,
        );
        skippedCount.agreements++;
        continue;
      }
      if (
        isNaN(agreement.termMonths) ||
        isNaN(agreement.initialPaymentMonths) ||
        agreement.termMonths <= 0
      ) {
        errors.push(
          `Agreement Row ${row} (${agreement.tenantEmail}): Invalid numerical value for 'termMonths' or 'initialPaymentMonths'.`,
        );
        skippedCount.agreements++;
        continue;
      }

      const tenantRecord = await databaseService.findTenantByEmailOrPhone(
        agreement.tenantEmail,
        null,
      );
      const buildingRecord = await databaseService.getAllBuildings({
        where: { name: agreement.buildingName },
        take: 1,
      });

      if (tenantRecord && buildingRecord.length > 0) {
        if (buildingRecord[0].status !== "Active") {
          errors.push(
            `Agreement Row ${row} ("${agreement.tenantEmail}"): Cannot create agreement in inactive building "${agreement.buildingName}".`,
          );
          skippedCount.agreements++;
          continue;
        }
        const spaceRecord = await databaseService.getAllSpaces({
          where: {
            buildingId: buildingRecord[0].id,
            spaceIdName: agreement.spaceIdName,
          },
          take: 1,
        });

        if (spaceRecord.length > 0) {
          const existingAgreement = await databaseService.getAllAgreements({
            where: {
              tenantId: tenantRecord.id,
              spaceId: spaceRecord[0].id,
              startDate: startDate,
            },
            take: 1,
          });

          if (existingAgreement.length === 0) {
            // Prepare agreement text by replacing common placeholders in the template
            const templateContent = agreementTemplate.content || "";
            const monthlyPrice = Number(spaceRecord[0].monthlyRentalPrice);
            const floor = (spaceRecord[0] as any).floor || "";
            const area = Number((spaceRecord[0] as any).area || 0);
            const formattedStartDate = startDate.toISOString().substring(0, 10);
            const paymentTermMonthsVal = Number(agreement.termMonths) || 0;
            const initialMonthsVal =
              Number(agreement.initialPaymentMonths) || 0;
            if (initialMonthsVal > paymentTermMonthsVal) {
              errors.push(
                `Agreement Row ${row} (${agreement.tenantEmail}): Initial payment months (${initialMonthsVal}) cannot exceed total term months (${paymentTermMonthsVal}).`,
              );
              skippedCount.agreements++;
              continue;
            }
            const initialPaymentAmountVal = !isNaN(monthlyPrice)
              ? monthlyPrice * initialMonthsVal
              : 0;
            const nextDueDateObj = addMonths(
              startDate,
              initialMonthsVal > 0 ? initialMonthsVal : 1,
            );
            const formattedNextDue = nextDueDateObj
              .toISOString()
              .substring(0, 10);

            const substitutedAgreementText = templateContent
              .replace(/{{\s*tenantName\s*}}/gi, tenantRecord.name || "")
              .replace(/{{\s*tenantEmail\s*}}/gi, tenantRecord.email || "")
              .replace(/{{\s*tenantPhone\s*}}/gi, tenantRecord.phone || "")
              .replace(/{{\s*buildingName\s*}}/gi, buildingRecord[0].name || "")
              .replace(
                /{{\s*buildingAddress\s*}}/gi,
                (buildingRecord[0] && (buildingRecord[0] as any).address) || "",
              )
              .replace(
                /{{\s*spaceIdName\s*}}/gi,
                spaceRecord[0].spaceIdName || "",
              )
              .replace(/{{\s*floor\s*}}/gi, floor)
              .replace(/{{\s*area\s*}}/gi, isNaN(area) ? "" : area.toString())
              .replace(/{{\s*startDate\s*}}/gi, formattedStartDate)
              .replace(
                /{{\s*paymentTermMonths\s*}}/gi,
                paymentTermMonthsVal.toString(),
              )
              .replace(
                /{{\s*monthlyRentalPrice\s*}}/gi,
                isNaN(monthlyPrice) ? "" : monthlyPrice.toFixed(2),
              )
              .replace(
                /{{\s*monthlyRent\s*}}/gi,
                isNaN(monthlyPrice) ? "" : monthlyPrice.toFixed(2),
              )
              .replace(
                /{{\s*initialPaymentMonths\s*}}/gi,
                initialMonthsVal.toString(),
              )
              .replace(
                /{{\s*initialPaymentAmount\s*}}/gi,
                initialPaymentAmountVal
                  ? initialPaymentAmountVal.toFixed(2)
                  : "",
              )
              .replace(/{{\s*nextPaymentDueDate\s*}}/gi, formattedNextDue)
              .replace(
                /{{\s*additionalTerms\s*}}/gi,
                agreement.additionalTerms || "",
              );

            const agreementData = {
              tenantId: tenantRecord.id,
              spaceId: spaceRecord[0].id,
              agreementTemplateId: data.agreementTemplateId,
              agreementText: substitutedAgreementText,
              startDate: startDate.toISOString(),
              monthlyRentalPrice: monthlyPrice,
              paymentTermMonths: agreement.termMonths,
              initialPaymentMonths: agreement.initialPaymentMonths,
              additionalTerms: agreement.additionalTerms || undefined,
            };
            const result = await createFullAgreementAction(agreementData);
            if (result.success) {
              createdCount.agreements++;
            } else {
              errors.push(
                `Agreement Row ${row} ("${agreement.tenantEmail}" in "${agreement.spaceIdName}"): ${result.error}`,
              );
              skippedCount.agreements++;
            }
          } else {
            skippedCount.agreements++;
          }
        } else {
          errors.push(
            `Agreement Row ${row} ("${agreement.tenantEmail}"): Space "${agreement.spaceIdName}" in Building "${agreement.buildingName}" not found.`,
          );
          skippedCount.agreements++;
        }
      } else {
        if (!tenantRecord)
          errors.push(
            `Agreement Row ${row}: Tenant with email "${agreement.tenantEmail}" not found.`,
          );
        if (buildingRecord.length === 0)
          errors.push(
            `Agreement Row ${row}: Building "${agreement.buildingName}" not found.`,
          );
        skippedCount.agreements++;
      }
    } catch (e: any) {
      errors.push(
        `Agreement Row ${row} ("${rawAgreement.tenantEmail}"): ${e.message}`,
      );
      skippedCount.agreements++;
    }
  }

  if (
    createdCount.spaces > 0 ||
    createdCount.tenants > 0 ||
    createdCount.agreements > 0
  ) {
    revalidatePath("/admin/agreements");
    revalidatePath("/admin/spaces");
    revalidatePath("/admin/tenants");
    revalidatePath("/admin/billing");
    revalidatePath("/admin/dashboard");
  }

  return { success: errors.length === 0, createdCount, skippedCount, errors };
}
