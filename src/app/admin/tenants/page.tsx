
export const dynamic = 'force-dynamic';

import { databaseService } from '@/lib/services/databaseService';
import type { Tenant as TenantTypePrisma, Space as SpaceTypePrisma, Agreement as AgreementTypePrisma, Prisma, User, Role } from '@prisma/client';
import { TenantsClientPage, type TenantWithRelations, type SpaceWithTenant, type ClientAgreement } from './components';
import { getUserAndManagedIds } from '@/lib/actions/server-helpers';
import { addMonths, isAfter } from 'date-fns'; // Import date-fns functions

// Server Component Part
export default async function TenantsPage() {
  const { isSuperAdmin, managedBuildingIds } = await getUserAndManagedIds();

  // A user can see unassigned tenants, and tenants assigned to buildings they manage.
  const tenantWhere: Prisma.TenantWhereInput = !isSuperAdmin
    ? {
        OR: [
          { rentedSpace: null },
          { rentedSpace: { buildingId: { in: managedBuildingIds! } } },
        ],
      }
    : {};
  
  const spaceWhere: Prisma.SpaceWhereInput = !isSuperAdmin ? { buildingId: { in: managedBuildingIds! } } : {};
  const agreementWhere: Prisma.AgreementWhereInput = !isSuperAdmin ? { space: { buildingId: { in: managedBuildingIds! } } } : {};

  const tenantsData = await databaseService.getAllTenants({ 
    where: tenantWhere,
    include: { 
      rentedSpace: true, 
      agreements: {
        include: {
          space: true,
        }
      }
    }, 
    orderBy: { createdAt: 'desc' } 
  });
  const spacesData = await databaseService.getAllSpaces({ 
    where: spaceWhere,
    include: { tenant: true }, 
    orderBy: [{ buildingName: 'asc' }, { spaceIdName: 'asc' }]
  });
  const agreementsData = await databaseService.getAllAgreements({
    where: agreementWhere,
    include: {
        space: true,
    }
  });

  const fallbackDate = new Date().toISOString();

  // Serialize date fields for client component props
  const serializableTenants: TenantWithRelations[] = tenantsData.map(tenant => ({
    ...tenant,
    createdAt: tenant.createdAt?.toISOString() || fallbackDate,
    updatedAt: tenant.updatedAt?.toISOString() || tenant.createdAt?.toISOString() || fallbackDate,
    rentedSpace: tenant.rentedSpace ? {
      ...tenant.rentedSpace,
      createdAt: tenant.rentedSpace.createdAt?.toISOString() || fallbackDate,
      updatedAt: tenant.rentedSpace.updatedAt?.toISOString() || tenant.rentedSpace.createdAt?.toISOString() || fallbackDate,
    } : null,
    agreements: tenant.agreements.map(ag => ({
      ...ag,
      startDate: ag.startDate?.toISOString() || fallbackDate,
      endDate: ag.endDate?.toISOString() || null,
      nextPaymentDueDate: ag.nextPaymentDueDate?.toISOString() || fallbackDate,
      createdAt: ag.createdAt?.toISOString() || fallbackDate,
      updatedAt: ag.updatedAt?.toISOString() || ag.createdAt?.toISOString() || fallbackDate,
      initialPaymentDate: ag.initialPaymentDate?.toISOString() || null,
      space: ag.space ? {
        ...ag.space,
        createdAt: ag.space.createdAt?.toISOString() || fallbackDate,
        updatedAt: ag.space.updatedAt?.toISOString() || ag.space.createdAt?.toISOString() || fallbackDate
      } : null,
    })),
  }));

  const serializableSpaces: SpaceWithTenant[] = spacesData.map(space => ({
    ...space,
    createdAt: space.createdAt?.toISOString() || fallbackDate,
    updatedAt: space.updatedAt?.toISOString() || space.createdAt?.toISOString() || fallbackDate,
    tenant: space.tenant ? {
      ...space.tenant,
      createdAt: space.tenant.createdAt?.toISOString() || fallbackDate,
      updatedAt: space.tenant.updatedAt?.toISOString() || space.tenant.createdAt?.toISOString() || fallbackDate,
      rentedSpaceId: space.tenant.rentedSpaceId || null, 
    } : null,
  }));
  
  const serializableAgreements: ClientAgreement[] = agreementsData.map(ag => ({
      ...ag,
      startDate: ag.startDate?.toISOString() || fallbackDate,
      endDate: ag.endDate?.toISOString() || null,
      nextPaymentDueDate: ag.nextPaymentDueDate?.toISOString() || fallbackDate,
      createdAt: ag.createdAt?.toISOString() || fallbackDate,
      updatedAt: ag.updatedAt?.toISOString() || ag.createdAt?.toISOString() || fallbackDate,
      initialPaymentDate: ag.initialPaymentDate?.toISOString() || null,
      space: ag.space ? {
        ...ag.space,
        createdAt: ag.space.createdAt?.toISOString() || fallbackDate,
        updatedAt: ag.space.updatedAt?.toISOString() || ag.space.createdAt?.toISOString() || fallbackDate
      } : null,
  }));


  return <TenantsClientPage initialTenants={serializableTenants} initialSpaces={serializableSpaces} initialAgreements={serializableAgreements} />;
}
