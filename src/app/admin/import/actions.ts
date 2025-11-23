
"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { createTenantAction } from '../tenants/actions';
import { createFullAgreementAction } from '../agreements/actions';
import { getUserAndManagedIds, getUserAndPermissions } from '@/lib/actions/server-helpers';
import type { Prisma } from '@prisma/client';

export async function getAgreementTemplatesForImportAction(): Promise<{ id: string; name: string }[]> {
  const { isSuperAdmin, currentUser } = await getUserAndManagedIds();
  
  const where: Prisma.AgreementTemplateWhereInput = !isSuperAdmin 
    ? { createdById: currentUser.id }
    : {};

  const templates = await databaseService.getAllAgreementTemplates({
    where,
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  return templates.map(t => ({ id: t.id, name: t.name }));
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
    if (phoneStr.length === 9 && !phoneStr.startsWith('0')) {
        return `0${phoneStr}`;
    }
    return phoneStr;
};

const sanitizeString = (value: any): string => (value ? String(value).trim() : '');
const sanitizeNumber = (value: any): number => {
  const num = parseFloat(String(value));
  return isNaN(num) ? 0 : num;
};

export async function processImportAction(data: ImportData) {
    const { isSuperAdmin, permissions } = await getUserAndPermissions();
    if (!isSuperAdmin && !permissions.has('import:manage')) {
        return { success: false, createdCount: { spaces: 0, tenants: 0, agreements: 0 }, skippedCount: { spaces: 0, tenants: 0, agreements: 0 }, errors: ["Permission denied."] };
    }

    let createdCount = { spaces: 0, tenants: 0, agreements: 0 };
    let skippedCount = { spaces: 0, tenants: 0, agreements: 0 };
    let errors: string[] = [];

    const agreementTemplate = await databaseService.getAgreementTemplateById(data.agreementTemplateId);
    if (!agreementTemplate) {
        errors.push("The selected agreement template could not be found.");
        return { success: false, createdCount, skippedCount, errors };
    }

    // --- 1. Process Spaces ---
    for (const [index, rawSpace] of data.spaces.entries()) {
        const row = index + 2;
        try {
            // Whitelisting and sanitizing fields
            const space = {
                buildingName: sanitizeString(rawSpace.buildingName),
                spaceIdName: sanitizeString(rawSpace.spaceIdName),
                floor: sanitizeString(rawSpace.floor),
                area: sanitizeNumber(rawSpace.area),
                monthlyRentalPrice: sanitizeNumber(rawSpace.monthlyRentalPrice),
                prorationShare: sanitizeNumber(rawSpace.prorationShare),
            };

            if (!space.buildingName || !space.spaceIdName) {
                errors.push(`Space Row ${row}: 'buildingName' and 'spaceIdName' are required.`);
                continue;
            }

            const buildingForSpace = await databaseService.getAllBuildings({ where: { name: space.buildingName }, take: 1 });
            if (buildingForSpace.length > 0) {
                const existingSpace = await databaseService.getAllSpaces({ where: { buildingId: buildingForSpace[0].id, spaceIdName: space.spaceIdName }, take: 1 });
                if (existingSpace.length === 0) {
                    await databaseService.createSpace({
                        building: { connect: { id: buildingForSpace[0].id } },
                        buildingName: space.buildingName,
                        spaceIdName: space.spaceIdName,
                        floor: space.floor,
                        area: space.area,
                        monthlyRentalPrice: space.monthlyRentalPrice,
                        utilityProrationShare: space.prorationShare / 100,
                    });
                    createdCount.spaces++;
                } else {
                    skippedCount.spaces++;
                }
            } else {
                errors.push(`Space Row ${row} (${space.spaceIdName}): Building "${space.buildingName}" not found.`);
            }
        } catch (e: any) {
            errors.push(`Space Row ${row} (${rawSpace.spaceIdName || 'N/A'}): ${e.message}`);
        }
    }
    
    // --- 2. Process Tenants ---
    for (const [index, rawTenant] of data.tenants.entries()) {
        const row = index + 2;
        // Whitelisting and sanitizing fields
        const tenant = {
            name: sanitizeString(rawTenant.name),
            email: sanitizeString(rawTenant.email),
            phone: normalizePhoneNumber(rawTenant.phone),
            alternativePhone: normalizePhoneNumber(rawTenant['alternativePhone (Optional)']),
            nationalId: sanitizeString(rawTenant.nationalId),
            representativeName: sanitizeString(rawTenant['representativeName (Optional)']),
            representativePhone: normalizePhoneNumber(rawTenant['representativePhone (Optional)']),
        };

        try {
            if (!tenant.phone) {
                errors.push(`Tenant Row ${row} (${tenant.name || 'N/A'}): Missing or invalid primary phone number.`);
                continue;
            }

            const existingTenant = await databaseService.findTenantByEmailOrPhone(tenant.email, tenant.phone);
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
                    errors.push(`Tenant Row ${row} (${tenant.name}): ${result.error}`);
                }
            } else {
                skippedCount.tenants++;
            }
        } catch (e: any) {
            errors.push(`Tenant Row ${row} (${tenant.name || 'N/A'}): ${e.message}`);
        }
    }
    
    // --- 3. Process Agreements ---
    for (const [index, rawAgreement] of data.agreements.entries()) {
        const row = index + 2;
        // Whitelisting and sanitizing fields
        const agreement = {
            tenantEmail: sanitizeString(rawAgreement.tenantEmail),
            buildingName: sanitizeString(rawAgreement.buildingName),
            spaceIdName: sanitizeString(rawAgreement.spaceIdName),
            startDate: sanitizeString(rawAgreement.startDate),
            termMonths: parseInt(String(rawAgreement.termMonths), 10) || 12,
            initialPaymentMonths: parseInt(String(rawAgreement.initialPaymentMonths), 10) || 1,
            additionalTerms: sanitizeString(rawAgreement['additionalTerms (Optional)']),
        };

        try {
            const tenantRecord = await databaseService.findTenantByEmailOrPhone(agreement.tenantEmail, null);
            const buildingRecord = await databaseService.getAllBuildings({ where: { name: agreement.buildingName }, take: 1 });

            if (tenantRecord && buildingRecord.length > 0) {
                const spaceRecord = await databaseService.getAllSpaces({ where: { buildingId: buildingRecord[0].id, spaceIdName: agreement.spaceIdName }, take: 1 });

                if (spaceRecord.length > 0) {
                    const startDate = new Date(agreement.startDate);
                    if (isNaN(startDate.getTime())) {
                        errors.push(`Agreement Row ${row}: Invalid start date for "${agreement.tenantEmail}".`);
                        continue;
                    }
                    
                    const existingAgreement = await databaseService.getAllAgreements({
                        where: { tenantId: tenantRecord.id, spaceId: spaceRecord[0].id, startDate: startDate },
                        take: 1
                    });

                    if (existingAgreement.length === 0) {
                        const agreementData = {
                            tenantId: tenantRecord.id,
                            spaceId: spaceRecord[0].id,
                            agreementText: "Agreement text generated via bulk import.", // Simplified text for import
                            startDate: startDate.toISOString(),
                            monthlyRentalPrice: sanitizeNumber(spaceRecord[0].monthlyRentalPrice),
                            paymentTermMonths: agreement.termMonths,
                            initialPaymentMonths: agreement.initialPaymentMonths,
                            additionalTerms: agreement.additionalTerms || undefined,
                        };
                        const result = await createFullAgreementAction(agreementData);
                        if(result.success) {
                            createdCount.agreements++;
                        } else {
                            errors.push(`Agreement Row ${row} ("${agreement.tenantEmail}" in "${agreement.spaceIdName}"): ${result.error}`);
                        }
                    } else {
                        skippedCount.agreements++;
                    }
                } else {
                    errors.push(`Agreement Row ${row} ("${agreement.tenantEmail}"): Space "${agreement.spaceIdName}" in Building "${agreement.buildingName}" not found.`);
                }
            } else {
                 if (!tenantRecord) errors.push(`Agreement Row ${row}: Tenant with email "${agreement.tenantEmail}" not found.`);
                 if (buildingRecord.length === 0) errors.push(`Agreement Row ${row}: Building "${agreement.buildingName}" not found.`);
            }
        } catch (e: any) {
            errors.push(`Agreement Row ${row} ("${agreement.tenantEmail}"): ${e.message}`);
        }
    }

    if (createdCount.spaces > 0 || createdCount.tenants > 0 || createdCount.agreements > 0) {
        revalidatePath('/admin/agreements');
        revalidatePath('/admin/spaces');
        revalidatePath('/admin/tenants');
        revalidatePath('/admin/billing');
        revalidatePath('/admin/dashboard');
    }

    return { success: errors.length === 0, createdCount, skippedCount, errors };
}
