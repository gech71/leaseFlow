
import { databaseService } from '@/lib/services/databaseService';
import type { Tenant as TenantTypePrisma, Space as SpaceTypePrisma, Agreement as AgreementTypePrisma, Prisma, User, Role } from '@prisma/client';
import { TenantsClientPage, type TenantWithRelations, type SpaceWithTenant, type ClientAgreement } from './components';
import { cookies } from 'next/headers';

// Insecure JWT payload decoder
function decodeJwtPayload(token: string): any | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Failed to decode JWT payload:', e);
    return null;
  }
}

// Gets current user from cookie
async function getCurrentUser(): Promise<(User & { roles: Role[] }) | null> {
    const ACCESS_TOKEN_KEY = 'leaseflow_access_token';
    const cookieStore = cookies();
    const accessToken = cookieStore.get(ACCESS_TOKEN_KEY)?.value;
    if (!accessToken) return null;
    
    const tokenPayload = decodeJwtPayload(accessToken);
    if (!tokenPayload || !tokenPayload.sub) return null;

    return await databaseService.getUserByExternalId(tokenPayload.sub, { roles: true });
}

// Server Component Part
export default async function TenantsPage() {
  const currentUser = await getCurrentUser();
  const isSuperAdmin = currentUser?.roles.some(role => role.name === 'SUPER_ADMIN') ?? false;
  let managedBuildingIds: string[] | undefined = undefined;

  if (!isSuperAdmin && currentUser) {
      const managedBuildings = await databaseService.getAllBuildings({ where: { managedByUserId: currentUser.userId } });
      managedBuildingIds = managedBuildings.map(b => b.id);
  }

  // A user can see tenants in their managed buildings, or tenants who are not yet assigned a space
  const tenantWhere: Prisma.TenantWhereInput = managedBuildingIds
    ? {
        OR: [
          { rentedSpaceId: null },
          { rentedSpace: { buildingId: { in: managedBuildingIds } } }
        ]
      }
    : {};
  
  const spaceWhere: Prisma.SpaceWhereInput = managedBuildingIds ? { buildingId: { in: managedBuildingIds } } : {};
  const agreementWhere: Prisma.AgreementWhereInput = managedBuildingIds ? { space: { buildingId: { in: managedBuildingIds } } } : {};

  const tenantsData = await databaseService.getAllTenants({ 
    where: tenantWhere,
    include: { 
      rentedSpace: true, 
      agreements: true
    }, 
    orderBy: { createdAt: 'desc' } 
  });
  const spacesData = await databaseService.getAllSpaces({ 
    where: spaceWhere,
    include: { tenant: true }, 
    orderBy: [{ buildingName: 'asc' }, { spaceIdName: 'asc' }]
  });
  const agreementsData = await databaseService.getAllAgreements({
    where: agreementWhere
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
