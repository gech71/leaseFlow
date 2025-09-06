
"use server";

import { databaseService } from '@/lib/services/databaseService';
import { createTenantAction } from '../tenants/actions';
import { createFullAgreementAction } from '../agreements/actions';

export async function getAgreementTemplatesForImportAction(): Promise<{ id: string; name: string }[]> {
  return databaseService.getAllAgreementTemplates({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}

// A simplified interface for the data we expect from the client
interface ImportData {
  buildings: any[];
  spaces: any[];
  tenants: any[];
  agreements: any[];
  agreementTemplateId: string;
}

export async function processImportAction(data: ImportData) {
    let createdCount = { buildings: 0, spaces: 0, tenants: 0, agreements: 0 };
    let skippedCount = { buildings: 0, spaces: 0, tenants: 0, agreements: 0 };
    let errors: string[] = [];

    const agreementTemplate = await databaseService.getAgreementTemplateById(data.agreementTemplateId);
    if (!agreementTemplate) {
        errors.push("The selected agreement template could not be found.");
        return { success: false, createdCount, skippedCount, errors };
    }

    // --- 1. Process Spaces ---
    for (const space of data.spaces) {
        try {
            const buildingForSpace = await databaseService.getAllBuildings({ where: { name: space.buildingName }, take: 1 });
            if (buildingForSpace.length > 0) {
                const existingSpace = await databaseService.getAllSpaces({ where: { buildingId: buildingForSpace[0].id, spaceIdName: space.spaceIdName }, take: 1 });
                if (existingSpace.length === 0) {
                    await databaseService.createSpace({
                        building: { connect: { id: buildingForSpace[0].id } },
                        buildingName: space.buildingName,
                        spaceIdName: space.spaceIdName,
                        floor: space.floor,
                        area: parseFloat(space.area),
                        monthlyRentalPrice: parseFloat(space.monthlyRentalPrice),
                        utilityProrationShare: parseFloat(space.prorationShare) / 100,
                    });
                    createdCount.spaces++;
                } else {
                    skippedCount.spaces++;
                }
            } else {
                errors.push(`Space "${space.spaceIdName}": Building "${space.buildingName}" not found.`);
            }
        } catch (e: any) {
            errors.push(`Space "${space.spaceIdName}": ${e.message}`);
        }
    }
    
    // --- 2. Process Tenants ---
    for (const tenant of data.tenants) {
        try {
            const existingTenant = await databaseService.findTenantByEmailOrPhone(tenant.email, tenant.phone);
            if (!existingTenant) {
                // This action handles user creation, tenant creation, and sending the welcome email.
                const result = await createTenantAction(tenant);
                if (result.success) {
                    createdCount.tenants++;
                } else {
                    errors.push(`Tenant "${tenant.name}": ${result.error}`);
                }
            } else {
                skippedCount.tenants++;
            }
        } catch (e: any) {
            errors.push(`Tenant "${tenant.name}": ${e.message}`);
        }
    }
    
    // --- 3. Process Agreements ---
    for (const agreement of data.agreements) {
        try {
            const tenantRecord = await databaseService.findTenantByEmailOrPhone(agreement.tenantEmail, null);
            const buildingRecord = await databaseService.getAllBuildings({ where: { name: agreement.buildingName }, take: 1 });

            if (tenantRecord && buildingRecord.length > 0) {
                const spaceRecord = await databaseService.getAllSpaces({ where: { buildingId: buildingRecord[0].id, spaceIdName: agreement.spaceIdName }, take: 1 });

                if (spaceRecord.length > 0) {
                    // Check if this agreement already exists (simple check)
                    const existingAgreement = await databaseService.getAllAgreements({
                        where: {
                            tenantId: tenantRecord.id,
                            spaceId: spaceRecord[0].id,
                            startDate: new Date(agreement.startDate),
                        },
                        take: 1
                    });

                    if (existingAgreement.length === 0) {
                        const agreementText = "Agreement text generated via bulk import."; // Simplified text for import
                        const agreementData = {
                            tenantId: tenantRecord.id,
                            spaceId: spaceRecord[0].id,
                            agreementText,
                            startDate: new Date(agreement.startDate).toISOString(),
                            monthlyRentalPrice: parseFloat(spaceRecord[0].monthlyRentalPrice),
                            paymentTermMonths: parseInt(agreement.termMonths, 10),
                            initialPaymentMonths: parseInt(agreement.initialPaymentMonths, 10),
                            additionalTerms: agreement.additionalTerms,
                        };
                        const result = await createFullAgreementAction(agreementData);
                        if(result.success) {
                            createdCount.agreements++;
                        } else {
                            errors.push(`Agreement for "${agreement.tenantEmail}" in "${agreement.spaceIdName}": ${result.error}`);
                        }
                    } else {
                        skippedCount.agreements++;
                    }
                } else {
                    errors.push(`Agreement for "${agreement.tenantEmail}": Space "${agreement.spaceIdName}" in Building "${agreement.buildingName}" not found.`);
                }
            } else {
                 if (!tenantRecord) errors.push(`Agreement processing skipped: Tenant with email "${agreement.tenantEmail}" not found.`);
                 if (buildingRecord.length === 0) errors.push(`Agreement processing skipped: Building "${agreement.buildingName}" not found.`);
            }
        } catch (e: any) {
            errors.push(`Agreement for "${agreement.tenantEmail}": ${e.message}`);
        }
    }


    return { success: errors.length === 0, createdCount, skippedCount, errors };
}
