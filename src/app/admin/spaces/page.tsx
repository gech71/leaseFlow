
export const dynamic = "force-dynamic";

import { databaseService } from "@/lib/services/databaseService";
import type {
  Space as SpaceTypePrisma,
  Building as BuildingTypePrisma,
  Prisma,
  User,
  Role,
  AgreementStatus,
} from "@prisma/client";
import { SpacesClientPage, type SpaceWithBuildingName } from "./components";
import { getUserAndManagedIds } from "@/lib/actions/server-helpers";
import { addMonths, isAfter, isBefore, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";

// This is the main Server Component for the page
export default async function SpacesPage() {
  const { isSuperAdmin, managedBuildingIds } = await getUserAndManagedIds();

  // --- Automatic Space Vacating Logic ---
  const today = startOfDay(new Date());
  // Find agreements that are now expired but their spaces are still marked as occupied.
  const expiredAgreementsOnOccupiedSpaces = await prisma.agreement.findMany({
    where: {
      space: {
        isOccupied: true,
        // Limit the check to buildings managed by the current user if not super admin
        ...(!isSuperAdmin ? { buildingId: { in: managedBuildingIds! } } : {}),
      },
    },
    select: {
      id: true,
      startDate: true,
      paymentTermMonths: true,
      spaceId: true,
      tenantId: true, // Fetch tenantId to disconnect it
    },
  });

  const relationsToUpdate: { spaceId: string; tenantId: string }[] = [];
  for (const agreement of expiredAgreementsOnOccupiedSpaces) {
    if (agreement.spaceId && agreement.tenantId) {
      const agreementEndDate = addMonths(
        agreement.startDate,
        agreement.paymentTermMonths,
      );
      if (isBefore(agreementEndDate, today)) {
        relationsToUpdate.push({
          spaceId: agreement.spaceId,
          tenantId: agreement.tenantId,
        });
      }
    }
  }

  // If we found any spaces to vacate, update them in a batch transaction.
  if (relationsToUpdate.length > 0) {
    const spaceIdsToVacate = relationsToUpdate.map(r => r.spaceId);
    const tenantIdsToUpdate = relationsToUpdate.map(r => r.tenantId);

    await prisma.$transaction([
      // Set the space as not occupied
      prisma.space.updateMany({
        where: { id: { in: spaceIdsToVacate } },
        data: { isOccupied: false },
      }),
      // Disconnect the tenant from their rented space
      prisma.tenant.updateMany({
        where: { id: { in: tenantIdsToUpdate } },
        data: { rentedSpaceId: null },
      }),
    ]);
  }
  // --- End Automatic Logic ---

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

  // Serialize dates and structure data for the client component
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
