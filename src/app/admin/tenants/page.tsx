
import { databaseService } from '@/lib/services/databaseService';
import type { Tenant as TenantTypePrisma, Space as SpaceTypePrisma, Agreement as AgreementTypePrisma } from '@prisma/client';
import { TenantsClientPage, type TenantWithRelations, type SpaceWithTenant, type ClientAgreement } from './components';
import { format } from 'date-fns';


// Server Component Part
export default async function TenantsPage() {
  const tenantsData = await databaseService.getAllTenants({ 
    include: { 
      rentedSpace: true, 
      agreements: { 
        // Consider if filtering active agreements here is better or on client
        // where: { endDate: { gte: new Date() } } 
      } 
    }, 
    orderBy: { createdAt: 'desc' } 
  });
  const spacesData = await databaseService.getAllSpaces({ 
    include: { tenant: true }, 
    orderBy: [{ buildingName: 'asc' }, { spaceIdName: 'asc' }]
  });
  const agreementsData = await databaseService.getAllAgreements({
    // where: { endDate: { gte: new Date() } }
  });

  // Serialize date fields for client component props
  const serializableTenants: TenantWithRelations[] = tenantsData.map(tenant => ({
    ...tenant,
    createdAt: tenant.createdAt.toISOString(),
    updatedAt: tenant.updatedAt?.toISOString() || tenant.createdAt.toISOString(), // Fallback to createdAt
    rentedSpace: tenant.rentedSpace ? {
      ...tenant.rentedSpace,
      createdAt: tenant.rentedSpace.createdAt.toISOString(),
      updatedAt: tenant.rentedSpace.updatedAt?.toISOString() || tenant.rentedSpace.createdAt.toISOString(), // Fallback
    } : null,
    agreements: tenant.agreements.map(ag => ({
      ...ag,
      startDate: ag.startDate.toISOString(),
      endDate: ag.endDate?.toISOString() || null,
      nextPaymentDueDate: ag.nextPaymentDueDate.toISOString(),
      createdAt: ag.createdAt.toISOString(),
      updatedAt: ag.updatedAt?.toISOString() || ag.createdAt.toISOString(), // Fallback
      initialPaymentDate: ag.initialPaymentDate?.toISOString() || null,
    })),
  }));

  const serializableSpaces: SpaceWithTenant[] = spacesData.map(space => ({
    ...space,
    createdAt: space.createdAt.toISOString(),
    updatedAt: space.updatedAt?.toISOString() || space.createdAt.toISOString(), // Fallback
    tenant: space.tenant ? {
      ...space.tenant,
      createdAt: space.tenant.createdAt.toISOString(),
      updatedAt: space.tenant.updatedAt?.toISOString() || space.tenant.createdAt.toISOString(), // Fallback
      rentedSpaceId: space.tenant.rentedSpaceId || null, 
    } : null,
  }));
  
  const serializableAgreements: ClientAgreement[] = agreementsData.map(ag => ({
      ...ag,
      startDate: ag.startDate.toISOString(),
      endDate: ag.endDate?.toISOString() || null,
      nextPaymentDueDate: ag.nextPaymentDueDate.toISOString(),
      createdAt: ag.createdAt.toISOString(),
      updatedAt: ag.updatedAt?.toISOString() || ag.createdAt.toISOString(), // Fallback
      initialPaymentDate: ag.initialPaymentDate?.toISOString() || null,
  }));


  return <TenantsClientPage initialTenants={serializableTenants} initialSpaces={serializableSpaces} initialAgreements={serializableAgreements} />;
}

