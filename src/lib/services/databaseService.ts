

import { prisma } from '@/lib/prisma';
import type { 
  Prisma, 
  Building, 
  Space, 
  Tenant, 
  Agreement, 
  Bill, 
  BuildingMonthlyUtilities, 
  PenaltyTier,
  User, 
  Role,
  AgreementTemplate,
  ArifPayment
} from '@prisma/client';

export class DatabaseService {

  // --- Building ---
  async createBuilding(data: Prisma.BuildingCreateInput): Promise<Building> {
    if (process.env.NODE_ENV === 'development') {
    }
    return prisma.building.create({ data });
  }

  async getBuildingById(id: string, include?: Prisma.BuildingInclude): Promise<Building | null> {
    return prisma.building.findUnique({ where: { id }, include });
  }

  async getAllBuildings(params?: {
    skip?: number;
    take?: number;
    cursor?: Prisma.BuildingWhereUniqueInput;
    where?: Prisma.BuildingWhereInput;
    orderBy?: Prisma.BuildingOrderByWithRelationInput | Prisma.BuildingOrderByWithRelationInput[];
    include?: Prisma.BuildingInclude;
  }): Promise<Building[]> {
    return prisma.building.findMany(params);
  }

  async updateBuilding(id: string, data: Prisma.BuildingUpdateInput): Promise<Building> {
    return prisma.building.update({ where: { id }, data });
  }

  async deleteBuilding(id: string): Promise<Building> {
    // Before deleting a building, we need to manually disconnect it from any users who manage it.
    await prisma.building.update({
        where: { id },
        data: {
            managers: {
                set: []
            }
        }
    });
    return prisma.building.delete({ where: { id } });
  }

  // --- Space ---
  async createSpace(data: Prisma.SpaceCreateInput): Promise<Space> {
    return prisma.space.create({ data });
  }

  async getSpaceById(id: string, include?: Prisma.SpaceInclude): Promise<Space | null> {
    return prisma.space.findUnique({ where: { id }, include });
  }

  async getAllSpaces(params?: {
    skip?: number;
    take?: number;
    cursor?: Prisma.SpaceWhereUniqueInput;
    where?: Prisma.SpaceWhereInput;
    orderBy?: Prisma.SpaceOrderByWithRelationInput | Prisma.SpaceOrderByWithRelationInput[];
    include?: Prisma.SpaceInclude;
  }): Promise<Space[]> {
    return prisma.space.findMany(params);
  }

  async updateSpace(id: string, data: Prisma.SpaceUpdateInput): Promise<Space> {
    return prisma.space.update({ where: { id }, data });
  }

  async deleteSpace(id: string): Promise<Space> {
    return prisma.space.delete({ where: { id } });
  }

  // --- Tenant ---
  async createTenant(data: Prisma.TenantCreateInput): Promise<Tenant> {
    return prisma.tenant.create({ data });
  }

  async findTenantByEmail(email: string): Promise<Tenant | null> {
    if (!email) return null;
    return prisma.tenant.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive' // case-insensitive match
        }
      }
    });
  }

  async findTenantByEmailOrPhone(email: string | null, phone: string | null): Promise<Tenant | null> {
    if (!email && !phone) return null;

    const whereClauses: Prisma.TenantWhereInput[] = [];
    if (email) {
      whereClauses.push({ email: { equals: email, mode: 'insensitive' as const } });
    }
    if (phone) {
      whereClauses.push({ phone: { equals: phone } });
      whereClauses.push({ alternativePhone: { equals: phone } });
    }

    if (whereClauses.length === 0) {
      return null;
    }

    return prisma.tenant.findFirst({
      where: {
        OR: whereClauses
      }
    });
  }

  async getTenantById(id: string, include?: Prisma.TenantInclude): Promise<Tenant | null> {
    return prisma.tenant.findUnique({ where: { id }, include });
  }

  async getAllTenants(params?: Prisma.TenantFindManyArgs): Promise<Tenant[]> {
    return prisma.tenant.findMany(params);
  }

  async updateTenant(id: string, data: Prisma.TenantUpdateInput): Promise<Tenant> {
    return prisma.tenant.update({ where: { id }, data });
  }

  async deleteTenant(id: string): Promise<Tenant> {
    return prisma.tenant.delete({ where: { id } });
  }

  // --- Agreement ---
  async createAgreement(data: Prisma.AgreementCreateInput): Promise<Agreement> {
    return prisma.agreement.create({ data });
  }

  async getAgreementById(id: string, include?: Prisma.AgreementInclude): Promise<Agreement | null> {
    return prisma.agreement.findUnique({ where: { id }, include });
  }

  async getAllAgreements(params?: {
    skip?: number;
    take?: number;
    cursor?: Prisma.AgreementWhereUniqueInput;
    where?: Prisma.AgreementWhereInput;
    orderBy?: Prisma.AgreementOrderByWithRelationInput | Prisma.AgreementOrderByWithRelationInput[];
    include?: Prisma.AgreementInclude;
  }): Promise<Agreement[]> {
    return prisma.agreement.findMany(params);
  }

  async updateAgreement(id: string, data: Prisma.AgreementUpdateInput): Promise<Agreement> {
    return prisma.agreement.update({ where: { id }, data });
  }

  async deleteAgreement(id: string): Promise<Agreement> {
    return prisma.agreement.delete({ where: { id } });
  }

  // --- Bill ---
  async createBill(data: Prisma.BillCreateInput): Promise<Bill> {
    return prisma.bill.create({ data });
  }

  async getBillById(id: string, include?: Prisma.BillInclude): Promise<Bill | null> {
    return prisma.bill.findUnique({ where: { id }, include });
  }

  async getAllBills(params?: {
    skip?: number;
    take?: number;
    cursor?: Prisma.BillWhereUniqueInput;
    where?: Prisma.BillWhereInput;
    orderBy?: Prisma.BillOrderByWithRelationInput | Prisma.BillOrderByWithRelationInput[];
    include?: Prisma.BillInclude;
  }): Promise<Bill[]> {
    return prisma.bill.findMany(params);
  }

  async updateBill(id: string, data: Prisma.BillUpdateInput): Promise<Bill> {
    return prisma.bill.update({ where: { id }, data });
  }

  async deleteBill(id: string): Promise<Bill> {
    return prisma.bill.delete({ where: { id } });
  }

  // --- BuildingMonthlyUtilities ---
  async createBuildingMonthlyUtilities(data: Prisma.BuildingMonthlyUtilitiesCreateInput): Promise<BuildingMonthlyUtilities> {
    return prisma.buildingMonthlyUtilities.create({ data });
  }

  async getBuildingMonthlyUtilitiesById(id: string, include?: Prisma.BuildingMonthlyUtilitiesInclude): Promise<BuildingMonthlyUtilities | null> {
    return prisma.buildingMonthlyUtilities.findUnique({ where: { id }, include });
  }
  
  async getBuildingMonthlyUtilitiesByBuildingMonthYear(
    buildingId: string, 
    month: number, 
    year: number, 
    include?: Prisma.BuildingMonthlyUtilitiesInclude
  ): Promise<BuildingMonthlyUtilities | null> {
    return prisma.buildingMonthlyUtilities.findFirst({ 
      where: { buildingId, month, year }, 
      include 
    });
  }

  async getAllBuildingMonthlyUtilities(params?: {
    skip?: number;
    take?: number;
    cursor?: Prisma.BuildingMonthlyUtilitiesWhereUniqueInput;
    where?: Prisma.BuildingMonthlyUtilitiesWhereInput;
    orderBy?: Prisma.BuildingMonthlyUtilitiesOrderByWithRelationInput | Prisma.BuildingMonthlyUtilitiesOrderByWithRelationInput[];
    include?: Prisma.BuildingMonthlyUtilitiesInclude;
  }): Promise<BuildingMonthlyUtilities[]> {
    return prisma.buildingMonthlyUtilities.findMany(params);
  }

  async upsertBuildingMonthlyUtilities(
    where: Prisma.BuildingMonthlyUtilitiesWhereUniqueInput, 
    create: Prisma.BuildingMonthlyUtilitiesCreateInput,
    update: Prisma.BuildingMonthlyUtilitiesUpdateInput,
    include?: Prisma.BuildingMonthlyUtilitiesInclude
  ): Promise<BuildingMonthlyUtilities> {
    return prisma.buildingMonthlyUtilities.upsert({ 
      where, 
      create, 
      update, 
      include 
    });
  }

  async deleteBuildingMonthlyUtilities(id: string): Promise<BuildingMonthlyUtilities> {
    return prisma.buildingMonthlyUtilities.delete({ where: { id } });
  }
  
  // --- PenaltyTier ---
  async createPenaltyTier(data: Prisma.PenaltyTierCreateInput): Promise<PenaltyTier> {
    return prisma.penaltyTier.create({ data });
  }

  async getPenaltyTierById(id: string): Promise<PenaltyTier | null> {
    return prisma.penaltyTier.findUnique({ where: { id }});
  }

  async getAllPenaltyTiers(params?: {
    skip?: number;
    take?: number;
    cursor?: Prisma.PenaltyTierWhereUniqueInput;
    where?: Prisma.PenaltyTierWhereInput;
    orderBy?: Prisma.PenaltyTierOrderByWithRelationInput | Prisma.PenaltyTierOrderByWithRelationInput[];
    include?: Prisma.PenaltyTierInclude; 
  }): Promise<PenaltyTier[]> {
    return prisma.penaltyTier.findMany(params);
  }

  async updatePenaltyTier(id: string, data: Prisma.PenaltyTierUpdateInput): Promise<PenaltyTier> {
    return prisma.penaltyTier.update({ where: { id }, data });
  }

  async deletePenaltyTier(id: string): Promise<PenaltyTier> {
    return prisma.penaltyTier.delete({ where: { id } });
  }

  async deletePenaltyTiersByBuildingId(buildingId: string): Promise<Prisma.BatchPayload> {
    return prisma.penaltyTier.deleteMany({ where: { buildingId } });
  }

  // --- User ---
  async createUser(data: Prisma.UserCreateInput): Promise<User> {
    return prisma.user.create({ data });
  }

  async getUserById(id: string, include?: Prisma.UserInclude): Promise<User | null> { 
    return prisma.user.findUnique({ where: { id }, include });
  }
  
  async findUserByPhoneNumber(phoneNumber: string, include?: Prisma.UserInclude): Promise<User | null> {
    if (!phoneNumber) return null;
    return prisma.user.findFirst({
        where: { phoneNumber: phoneNumber },
        include
    });
  }

  async findUserByEmailOrPhone(email: string | null, phone: string | null): Promise<User | null> {
    if (!email && !phone) return null;
    const whereClauses: Prisma.UserWhereInput[] = [];
    if (email) whereClauses.push({ email: { equals: email, mode: 'insensitive' } });
    if (phone) whereClauses.push({ phoneNumber: phone });
    return prisma.user.findFirst({ where: { OR: whereClauses } });
  }


  async getAllUsers(params?: {
    skip?: number;
    take?: number;
    cursor?: Prisma.UserWhereUniqueInput;
    where?: Prisma.UserWhereInput;
    orderBy?: Prisma.UserOrderByWithRelationInput | Prisma.UserOrderByWithRelationInput[];
    include?: Prisma.UserInclude;
  }): Promise<User[]> {
    return prisma.user.findMany(params);
  }

  async updateUser(id: string, data: Prisma.UserUpdateInput): Promise<User> { 
    return prisma.user.update({ where: { id }, data });
  }

  async deleteUser(id: string): Promise<User> {
    // Manually handle disconnecting relations before deleting the user.
    await prisma.user.update({
        where: { id },
        data: {
            managedBuildings: { set: [] },
            createdRoles: {
                updateMany: {
                    where: { createdById: id },
                    data: { createdById: null }
                }
            },
            createdTenants: {
                updateMany: {
                    where: { createdById: id },
                    data: { createdById: null }
                }
            },
            createdUsers: {
                updateMany: {
                    where: { createdById: id },
                    data: { createdById: null }
                }
            },
        }
    });
    return prisma.user.delete({ where: { id } });
  }


  // --- Role ---
  async createRole(data: Prisma.RoleCreateInput): Promise<Role> {
    return prisma.role.create({ data });
  }

  async getRoleById(id: string): Promise<Role | null> {
    return prisma.role.findUnique({ where: { id }});
  }
  
  async getRoleByName(name: string): Promise<Role | null> {
    return prisma.role.findFirst({ where: { name } });
  }

  async getRoleByNameAndCreator(name: string, createdById?: string | null): Promise<Role | null> {
    const where: Prisma.RoleWhereInput = { name };
    // If createdById is explicitly null, it's a system role check.
    // If undefined, we don't filter by creator (might not be desired).
    // If a string, it's a user-created role check.
    if (createdById === null) {
      where.createdById = null;
    } else if (createdById) {
      where.createdById = createdById;
    }
    return prisma.role.findFirst({ where });
  }

  async getAllRoles(params?: {
    skip?: number;
    take?: number;
    cursor?: Prisma.RoleWhereUniqueInput;
    where?: Prisma.RoleWhereInput;
    orderBy?: Prisma.RoleOrderByWithRelationInput | Prisma.RoleOrderByWithRelationInput[];
    include?: Prisma.RoleInclude;
  }): Promise<Role[]> {
    return prisma.role.findMany(params);
  }

  async updateRole(id: string, data: Prisma.RoleUpdateInput): Promise<Role> {
    return prisma.role.update({ where: { id }, data });
  }

  async deleteRole(id: string): Promise<Role> {
    // Optional: Check if role is in use before deleting
    const usersWithRole = await prisma.user.count({ where: { roles: { some: { id } } } });
    if (usersWithRole > 0) {
      throw new Error("Cannot delete role as it is currently assigned to one or more users.");
    }
    return prisma.role.delete({ where: { id } });
  }

  // --- AgreementTemplate ---
  async createAgreementTemplate(data: Prisma.AgreementTemplateCreateInput): Promise<AgreementTemplate> {
    return prisma.agreementTemplate.create({ data });
  }

  async getAgreementTemplateById(id: string): Promise<AgreementTemplate | null> {
    return prisma.agreementTemplate.findUnique({ where: { id } });
  }

  async getAllAgreementTemplates(params?: {
    where?: Prisma.AgreementTemplateWhereInput;
    orderBy?: Prisma.AgreementTemplateOrderByWithRelationInput | Prisma.AgreementTemplateOrderByWithRelationInput[];
    select?: Prisma.AgreementTemplateSelect;
  }): Promise<AgreementTemplate[]> {
    return prisma.agreementTemplate.findMany(params as any);
  }

  async updateAgreementTemplate(id: string, data: Prisma.AgreementTemplateUpdateInput): Promise<AgreementTemplate> {
    return prisma.agreementTemplate.update({ where: { id }, data });
  }

  async deleteAgreementTemplate(id: string): Promise<AgreementTemplate> {
    return prisma.agreementTemplate.delete({ where: { id } });
  }

  // --- ArifPayment ---
  async createArifPayment(data: Prisma.ArifPaymentCreateInput): Promise<ArifPayment> {
    return prisma.arifPayment.create({ data });
  }

  async getArifPaymentBySessionId(sessionId: string): Promise<ArifPayment | null> {
    return prisma.arifPayment.findUnique({ where: { sessionId } });
  }
  
  async updateArifPayment(id: string, data: Prisma.ArifPaymentUpdateInput): Promise<ArifPayment> {
    return prisma.arifPayment.update({ where: { id }, data });
  }
}

export const databaseService = new DatabaseService();
