

'use server';

import { databaseService } from '@/lib/services/databaseService';
import { getUserAndManagedIds } from '@/lib/actions/server-helpers';
import { getMonth, getYear, isAfter, addMonths } from 'date-fns';
import type { Prisma, Building, Space, Agreement, Bill } from '@prisma/client';
import { headers } from 'next/headers';

// This is the new entry point for the dashboard data.
// It will be called via a POST request from the client-side fetch.
export async function POST(req: Request) {
    if (new URL(req.url).searchParams.get('_action') === 'getDashboardDataAction') {
        const data = await getDashboardData();
        return Response.json(data);
    }
    return Response.json({ error: 'Invalid action' }, { status: 400 });
}


// Define the types that will be serialized and sent to the client.
// This helps ensure data consistency and avoids sending oversized objects.
export interface ClientBuilding {
  id: string;
  name: string;
}

export interface ClientSpace {
  id: string;
  buildingId: string;
  isOccupied: boolean;
  area: number;
}

export interface ClientAgreement {
  id: string;
  tenantId: string;
  spaceId: string | null;
  startDate: string; // ISO string
  paymentTermMonths: number;
  tenant: { name: string } | null;
  space: { spaceIdName: string } | null;
}

export interface ClientBill {
  agreementId: string;
  status: string;
  totalAmount: number;
  paymentDate: string | null; // ISO string
  billDate: string; // ISO string
}

export interface ClientUtility {
  buildingId: string;
  year: number;
  month: number;
  totalCost: number;
}

export interface DashboardData {
  buildings: ClientBuilding[];
  spaces: ClientSpace[];
  agreements: ClientAgreement[];
  allBills: ClientBill[];
  allUtilities: ClientUtility[];
  error: string | null;
}

// This is the actual data-fetching function, kept private to this file.
async function getDashboardData(): Promise<DashboardData> {
  try {
    const { isSuperAdmin, managedBuildingIds } = await getUserAndManagedIds();

    if (!isSuperAdmin && managedBuildingIds?.length === 0) {
      return {
        buildings: [],
        spaces: [],
        agreements: [],
        allBills: [],
        allUtilities: [],
        error: 'No buildings assigned.',
      };
    }

    const buildingWhere = managedBuildingIds ? { id: { in: managedBuildingIds } } : {};
    const spaceWhere = managedBuildingIds ? { buildingId: { in: managedBuildingIds } } : {};
    const agreementWhere = managedBuildingIds ? { space: { buildingId: { in: managedBuildingIds } } } : {};
    const billWhere = managedBuildingIds ? { agreement: { space: { buildingId: { in: managedBuildingIds } } } } : {};
    const utilitiesWhere = managedBuildingIds ? { buildingId: { in: managedBuildingIds } } : {};

    const [buildingsData, spacesData, agreementsData, allBillsData, allUtilitiesRaw] = await Promise.all([
      databaseService.getAllBuildings({ where: buildingWhere, select: { id: true, name: true } }),
      databaseService.getAllSpaces({ where: spaceWhere, select: { id: true, buildingId: true, isOccupied: true, area: true } }),
      databaseService.getAllAgreements({ where: agreementWhere, select: { id: true, tenantId: true, spaceId: true, startDate: true, paymentTermMonths: true, tenant: { select: { name: true } }, space: { select: { spaceIdName: true } } } }),
      databaseService.getAllBills({ where: billWhere, select: { agreementId: true, status: true, totalAmount: true, paymentDate: true, billDate: true } }),
      databaseService.getAllBuildingMonthlyUtilities({ where: utilitiesWhere, include: { utilities: true } }),
    ]);

    const allUtilities = allUtilitiesRaw.map((u) => ({
      buildingId: u.buildingId,
      year: u.year,
      month: u.month,
      totalCost: Number(u.utilities.reduce((sum, item) => sum + Number(item.totalCost), 0)),
    }));

    // Serialize dates for client components
    const agreements = agreementsData.map(a => ({
        ...a,
        startDate: a.startDate.toISOString(),
    }));

    const allBills = allBillsData.map(b => ({
        ...b,
        totalAmount: Number(b.totalAmount),
        billDate: b.billDate.toISOString(),
        paymentDate: b.paymentDate?.toISOString() || null,
    }));
    
    const spaces = spacesData.map(s => ({
        ...s,
        area: Number(s.area)
    }));


    return {
      buildings: buildingsData,
      spaces,
      agreements,
      allBills,
      allUtilities,
      error: null,
    };
  } catch (e) {
    console.error("Error fetching dashboard data:", e);
    return {
        buildings: [],
        spaces: [],
        agreements: [],
        allBills: [],
        allUtilities: [],
        error: "Failed to load dashboard data."
    }
  }
}
