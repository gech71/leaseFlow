
export const dynamic = "force-dynamic";

import { databaseService } from "@/lib/services/databaseService";
import type {
  Space as SpaceTypePrisma,
  Building as BuildingTypePrisma,
  Prisma,
  User,
  Role,
} from "@prisma/client";
import { SpacesClientPage, type SpaceWithBuildingName } from "./components";
import { getUserAndManagedIds } from "@/lib/actions/server-helpers";
import { addMonths, isAfter, isBefore, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";

export default async function SpacesPage() {
  const { isSuperAdmin, managedBuildingIds } = await getUserAndManagedIds();

  const today = startOfDay(new Date());
  const expiredAgreementsOnOccupiedSpaces = await prisma.agreement.findMany({
    where: {
      space: {
        isOccupied: true,
        ...(!isSuperAdmin ? { buildingId: { in: managedBuildingIds! } } : {}),
      },
    },
    select: {
      id: true,
      startDate: true,
      paymentTermMonths: true,
      spaceId: true,
    },
  });

  const spaceIdsToVacate: string[] = [];
  for (const agreement of expiredAgreementsOnOccupiedSpaces) {
    if (agreement.spaceId) {
      const agreementEndDate = addMonths(
        agreement.startDate,
        agreement.paymentTermMonths,
      );
      if (isBefore(agreementEndDate, today)) {
        spaceIdsToVacate.push(agreement.spaceId);
      }
    }
  }

  if (spaceIdsToVacate.length > 0) {
    await prisma.space.updateMany({
      where: {
        id: { in: spaceIdsToVacate },
      },
      data: {
        isOccupied: false,
        tenantId: null,
      },
    });
  }

  const spaceWhere: Prisma.SpaceWhereInput = !isSuperAdmin
    ? { buildingId: { in: managedBuildingIds! } }
    : {};
  const buildingWhere: Prisma.BuildingWhereInput = !isSuperAdmin
    ? { id: { in: managedBuildingIds! } }
    : {};

  const spacesData = await databaseService.getAllSpaces({
    where: spaceWhere,
    include: {
      building: true,
      agreements: true,
    },
    orderBy: { createdAt: "desc" },
  });
  const buildingsData = await databaseService.getAllBuildings({
    where: buildingWhere,
    orderBy: { name: "asc" },
  });

  const serializableSpaces: SpaceWithBuildingName[] = spacesData.map(
    (space) => {
      let availabilityDate: string | null = null;
      if (space.isOccupied && space.agreements.length > 0) {
        const activeAgreements = space.agreements
          .filter((ag) =>
            isAfter(addMonths(ag.startDate, ag.paymentTermMonths), new Date()),
          )
          .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());

        if (activeAgreements.length > 0) {
          const endDate = addMonths(
            activeAgreements[0].startDate,
            activeAgreements[0].paymentTermMonths,
          );
          availabilityDate = endDate.toISOString();
        }
      }

      return {
        ...space,
        area: Number(space.area),
        utilityProrationShare: Number(space.utilityProrationShare),
        monthlyRentalPrice: Number(space.monthlyRentalPrice),
        createdAt: space.createdAt.toISOString(),
        updatedAt: space.updatedAt?.toISOString() || new Date().toISOString(),
        buildingName: space.building.name,
        availabilityDate,
        agreements: space.agreements.map((ag) => ({
          ...ag,
          monthlyRentalPrice: Number(ag.monthlyRentalPrice),
          initialPaymentAmount: ag.initialPaymentAmount
            ? Number(ag.initialPaymentAmount)
            : null,
        })),
      };
    },
  );

  const serializableBuildings: BuildingTypePrisma[] = buildingsData.map(
    (building) => ({
      ...building,
      createdAt: building.createdAt.toISOString(),
      updatedAt: building.updatedAt?.toISOString() || new Date().toISOString(),
      penaltyPolicyTiers: (building as any).penaltyPolicyTiers || [],
    }),
  );

  return (
    <SpacesClientPage
      initialSpaces={serializableSpaces}
      initialBuildings={serializableBuildings}
    />
  );
}
