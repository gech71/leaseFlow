
import { prisma } from '@/lib/prisma';
import type { 
  Prisma, 
  Building, 
  Space, 
  Tenant, 
  Agreement, 
  Bill, 
  BuildingMonthlyUtilities, 
  PenaltyTier 
} from '@prisma/client';

export class DatabaseService {

  // --- Building ---
  async createBuilding(data: Prisma.BuildingCreateInput): Promise<Building> {
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

  async getTenantById(id: string, include?: Prisma.TenantInclude): Promise<Tenant | null> {
    return prisma.tenant.findUnique({ where: { id }, include });
  }

  async getAllTenants(params?: {
    skip?: number;
    take?: number;
    cursor?: Prisma.TenantWhereUniqueInput;
    where?: Prisma.TenantWhereInput;
    orderBy?: Prisma.TenantOrderByWithRelationInput | Prisma.TenantOrderByWithRelationInput[];
    include?: Prisma.TenantInclude;
  }): Promise<Tenant[]> {
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
    buildingId: string, // Changed from buildingName to buildingId
    month: number, 
    year: number, 
    include?: Prisma.BuildingMonthlyUtilitiesInclude
  ): Promise<BuildingMonthlyUtilities | null> {
    return prisma.buildingMonthlyUtilities.findFirst({ 
      where: { buildingId, month, year }, // Updated to use buildingId
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

  async updateBuildingMonthlyUtilities(id: string, data: Prisma.BuildingMonthlyUtilitiesUpdateInput): Promise<BuildingMonthlyUtilities> {
    return prisma.buildingMonthlyUtilities.update({ where: { id }, data });
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
}

export const databaseService = new DatabaseService();
