
"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { createTenantAction } from '../tenants/actions';
import { createFullAgreementAction } from '../agreements/actions';
import { getUserAndManagedIds } from '@/lib/actions/server-helpers';
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
    let createdCount = { spaces: 0, tenants: 0, agreements: 0 };
    let skippedCount = { spaces: 0, tenants: 0, agreements: 0 };
    let errors: string[] = [];

    const agreementTemplate = await databaseService.getAgreementTemplateById(data.agreementTemplateId);
    if (!agreementTemplate) {
        errors.push("The selected agreement template could not be found.");
        return { success: false, createdCount, skippedCount, errors };
    }

    for (const [index, space] of data.spaces.entries()) {
        const row = index + 2;
        try {
            const buildingName = sanitizeString(space.buildingName);
            const spaceIdName = sanitizeString(space.spaceIdName);
            if (!buildingName || !spaceIdName) {
                errors.push(`Space Row ${row}: 'buildingName' and 'spaceIdName' are required.`);
                continue;
            }

            const buildingForSpace = await databaseService.getAllBuildings({ where: { name: buildingName }, take: 1 });
            if (buildingForSpace.length > 0) {
                const existingSpace = await databaseService.getAllSpaces({ where: { buildingId: buildingForSpace[0].id, spaceIdName: spaceIdName }, take: 1 });
                if (existingSpace.length === 0) {
                    await databaseService.createSpace({
                        building: { connect: { id: buildingForSpace[0].id } },
                        buildingName: buildingName,
                        spaceIdName: spaceIdName,
                        floor: sanitizeString(space.floor),
                        area: sanitizeNumber(space.area),
                        monthlyRentalPrice: sanitizeNumber(space.monthlyRentalPrice),
                        utilityProrationShare: sanitizeNumber(space.prorationShare) / 100,
                    });
                    createdCount.spaces++;
                } else {
                    skippedCount.spaces++;
                }
            } else {
                errors.push(`Space Row ${row} (${spaceIdName}): Building "${buildingName}" not found.`);
            }
        } catch (e: any) {
            errors.push(`Space Row ${row} (${space.spaceIdName || 'N/A'}): ${e.message}`);
        }
    }
    
    for (const [index, tenant] of data.tenants.entries()) {
        const row = index + 2;
        const tenantName = sanitizeString(tenant.name);
        try {
            const normalizedPhone = normalizePhoneNumber(tenant.phone);
            if (!normalizedPhone) {
                errors.push(`Tenant Row ${row} (${tenantName}): Missing or invalid primary phone number.`);
                continue;
            }

            const existingTenant = await databaseService.findTenantByEmailOrPhone(sanitizeString(tenant.email), normalizedPhone);
            if (!existingTenant) {
                const tenantData = {
                    name: tenantName,
                    email: sanitizeString(tenant.email),
                    phone: normalizedPhone,
                    alternativePhone: normalizePhoneNumber(tenant['alternativePhone (Optional)']),
                    nationalId: sanitizeString(tenant.nationalId) || undefined,
                    representativeName: sanitizeString(tenant['representativeName (Optional)']) || undefined,
                    representativePhone: normalizePhoneNumber(tenant['representativePhone (Optional)']),
                };
                
                const result = await createTenantAction(tenantData);
                if (result.success) {
                    createdCount.tenants++;
                } else {
                    errors.push(`Tenant Row ${row} (${tenantName}): ${result.error}`);
                }
            } else {
                skippedCount.tenants++;
            }
        } catch (e: any) {
            errors.push(`Tenant Row ${row} (${tenantName}): ${e.message}`);
        }
    }
    
    for (const [index, agreement] of data.agreements.entries()) {
        const row = index + 2;
        const tenantEmail = sanitizeString(agreement.tenantEmail);
        const buildingName = sanitizeString(agreement.buildingName);
        const spaceIdName = sanitizeString(agreement.spaceIdName);
        try {
            const tenantRecord = await databaseService.findTenantByEmailOrPhone(tenantEmail, null);
            const buildingRecord = await databaseService.getAllBuildings({ where: { name: buildingName }, take: 1 });

            if (tenantRecord && buildingRecord.length > 0) {
                const spaceRecord = await databaseService.getAllSpaces({ where: { buildingId: buildingRecord[0].id, spaceIdName: spaceIdName }, take: 1 });

                if (spaceRecord.length > 0) {
                    const startDate = new Date(sanitizeString(agreement.startDate));
                    if (isNaN(startDate.getTime())) {
                        errors.push(`Agreement Row ${row}: Invalid start date for "${tenantEmail}".`);
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
                            agreementText: "Agreement text generated via bulk import.",
                            startDate: startDate.toISOString(),
                            monthlyRentalPrice: sanitizeNumber(spaceRecord[0].monthlyRentalPrice),
                            paymentTermMonths: parseInt(String(agreement.termMonths), 10) || 12,
                            initialPaymentMonths: parseInt(String(agreement.initialPaymentMonths), 10) || 1,
                            additionalTerms: sanitizeString(agreement['additionalTerms (Optional)']) || undefined,
                        };
                        const result = await createFullAgreementAction(agreementData);
                        if(result.success) {
                            createdCount.agreements++;
                        } else {
                            errors.push(`Agreement Row ${row} ("${tenantEmail}" in "${spaceIdName}"): ${result.error}`);
                        }
                    } else {
                        skippedCount.agreements++;
                    }
                } else {
                    errors.push(`Agreement Row ${row} ("${tenantEmail}"): Space "${spaceIdName}" in Building "${buildingName}" not found.`);
                }
            } else {
                 if (!tenantRecord) errors.push(`Agreement Row ${row}: Tenant with email "${tenantEmail}" not found.`);
                 if (buildingRecord.length === 0) errors.push(`Agreement Row ${row}: Building "${buildingName}" not found.`);
            }
        } catch (e: any) {
            errors.push(`Agreement Row ${row} ("${tenantEmail}"): ${e.message}`);
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
