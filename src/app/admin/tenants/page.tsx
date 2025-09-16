
export const dynamic = 'force-dynamic';

import { databaseService } from '@/lib/services/databaseService';
import type { Tenant as TenantTypePrisma, Space as SpaceTypePrisma, Agreement as AgreementTypePrisma, Prisma, User, Role } from '@prisma/client';
import { TenantsClientPage, type TenantWithRelations, type SpaceWithTenant, type ClientAgreement } from './components';
import { getUserAndManagedIds } from '@/lib/actions/server-helpers';
import { addMonths, isAfter } from 'date-fns'; // Import date-fns functions

// This is the main Server Component for the page
export default async function TenantsPage() {
  const { isSuperAdmin, managedBuildingIds } = await getUserAndManagedIds();
  
  // A non-super-admin can see:
  // 1. Tenants who are renting a space in a building they manage.
  // 2. ANY tenant who is not currently assigned to a space.
  const tenantWhere: Prisma.TenantWhereInput = !isSuperAdmin
    ? {
        OR: [
          { agreements: { some: { space: { buildingId: { in: managedBuildingIds! } } } } },
          { rentedSpaceId: null }
        ]
      }
    : {};

  // This is the critical change: filter included agreements for non-super-admins
  const agreementsInclude = {
    where: !isSuperAdmin ? { space: { buildingId: { in: managedBuildingIds! } } } : undefined,
    include: {
      space: true,
    }
  };
  
  const spaceWhere: Prisma.SpaceWhereInput = !isSuperAdmin ? { buildingId: { in: managedBuildingIds! } } : {};
  const agreementWhere: Prisma.AgreementWhereInput = !isSuperAdmin ? { space: { buildingId: { in: managedBuildingIds! } } } : {};

  const tenantsData = await databaseService.getAllTenants({ 
    where: tenantWhere,
    include: { 
      rentedSpace: true, 
      agreements: agreementsInclude
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
      area: Number(tenant.rentedSpace.area),
      utilityProrationShare: Number(tenant.rentedSpace.utilityProrationShare),
      monthlyRentalPrice: Number(tenant.rentedSpace.monthlyRentalPrice),
      createdAt: tenant.rentedSpace.createdAt?.toISOString() || fallbackDate,
      updatedAt: tenant.rentedSpace.updatedAt?.toISOString() || tenant.rentedSpace.createdAt?.toISOString() || fallbackDate,
    } : null,
    agreements: tenant.agreements.map(ag => ({
      ...ag,
      monthlyRentalPrice: Number(ag.monthlyRentalPrice),
      initialPaymentAmount: ag.initialPaymentAmount ? Number(ag.initialPaymentAmount) : null,
      startDate: ag.startDate?.toISOString() || fallbackDate,
      endDate: ag.endDate?.toISOString() || null,
      nextPaymentDueDate: ag.nextPaymentDueDate?.toISOString() || fallbackDate,
      createdAt: ag.createdAt?.toISOString() || fallbackDate,
      updatedAt: ag.updatedAt?.toISOString() || ag.createdAt?.toISOString() || fallbackDate,
      initialPaymentDate: ag.initialPaymentDate?.toISOString() || null,
      space: ag.space ? {
        ...ag.space,
        area: Number(ag.space.area),
        utilityProrationShare: Number(ag.space.utilityProrationShare),
        monthlyRentalPrice: Number(ag.space.monthlyRentalPrice),
        createdAt: ag.space.createdAt?.toISOString() || fallbackDate,
        updatedAt: ag.space.updatedAt?.toISOString() || ag.space.createdAt?.toISOString() || fallbackDate
      } : null,
    })),
  }));

  const serializableSpaces: SpaceWithTenant[] = spacesData.map(space => ({
    ...space,
    area: Number(space.area),
    utilityProrationShare: Number(space.utilityProrationShare),
    monthlyRentalPrice: Number(space.monthlyRentalPrice),
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
      monthlyRentalPrice: Number(ag.monthlyRentalPrice),
      initialPaymentAmount: ag.initialPaymentAmount ? Number(ag.initialPaymentAmount) : null,
      startDate: ag.startDate?.toISOString() || fallbackDate,
      endDate: ag.endDate?.toISOString() || null,
      nextPaymentDueDate: ag.nextPaymentDueDate?.toISOString() || fallbackDate,
      createdAt: ag.createdAt?.toISOString() || fallbackDate,
      updatedAt: ag.updatedAt?.toISOString() || ag.createdAt?.toISOString() || fallbackDate,
      initialPaymentDate: ag.initialPaymentDate?.toISOString() || null,
      space: ag.space ? {
        ...ag.space,
        area: Number(ag.space.area),
        utilityProrationShare: Number(ag.space.utilityProrationShare),
        monthlyRentalPrice: Number(ag.space.monthlyRentalPrice),
        createdAt: ag.space.createdAt?.toISOString() || fallbackDate,
        updatedAt: ag.space.updatedAt?.toISOString() || ag.space.createdAt?.toISOString() || fallbackDate
      } : null,
  }));


  return <TenantsClientPage initialTenants={serializableTenants} initialSpaces={serializableSpaces} initialAgreements={serializableAgreements} />;
}
