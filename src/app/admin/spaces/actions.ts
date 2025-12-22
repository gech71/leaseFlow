"use server";

import { revalidatePath } from "next/cache";
import { databaseService } from "@/lib/services/databaseService";
import { Prisma, type BuildingStatus } from "@prisma/client";
import { addMonths, isAfter } from "date-fns"; // Import date-fns functions
import { getUserAndManagedIds } from "@/lib/actions/server-helpers";

export async function createSpaceAction(data: Prisma.SpaceCreateInput) {
  try {
    const { currentUser, isSuperAdmin, permissions, managedBuildingIds } =
      await getUserAndManagedIds();
    if (!isSuperAdmin && !permissions.has("space:create")) {
      return { success: false, error: "Access Denied" };
    }

    const targetBuildingId: string | undefined =
      (data as any).buildingId ?? (data as any)?.building?.connect?.id;
    if (!isSuperAdmin && managedBuildingIds && targetBuildingId) {
      if (!managedBuildingIds.includes(targetBuildingId)) {
        return { success: false, error: "Permission denied." };
      }
    }

    // Use scalar FK fields to avoid Prisma client/schema mismatches where
    // nested relation inputs (e.g. createdBy/connect) may not exist.
    const createData: Prisma.SpaceUncheckedCreateInput = {
      ...(data as unknown as Prisma.SpaceUncheckedCreateInput),
      status: isSuperAdmin ? "Active" : "Pending",
      rejectionReason: null,
      createdById: currentUser.id,
      ...(isSuperAdmin ? { approvedById: currentUser.id } : {}),
    };

    const newSpace = await databaseService.createSpace(createData);
    revalidatePath("/admin/spaces");
    // Convert Decimal fields to numbers before returning to the client
    const serializableSpace = {
      ...newSpace,
      area: Number(newSpace.area),
      utilityProrationShare: Number(newSpace.utilityProrationShare),
      monthlyRentalPrice: Number(newSpace.monthlyRentalPrice),
    };
    return { success: true, space: serializableSpace };
  } catch (error: any) {
    console.error("Error creating space:", error);
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        success: false,
        error:
          "A space with this ID/Name already exists in the selected building. Please use a unique name.",
      };
    }
    return {
      success: false,
      error: error.message || "Failed to create space.",
    };
  }
}

export async function updateSpaceAction(
  id: string,
  data: Prisma.SpaceUpdateInput,
) {
  try {
    const { currentUser, isSuperAdmin, permissions, managedBuildingIds } =
      await getUserAndManagedIds();
    if (!isSuperAdmin && !permissions.has("space:edit")) {
      return { success: false, error: "Access Denied" };
    }

    if (!isSuperAdmin && managedBuildingIds) {
      const existing = await databaseService.getSpaceById(id);
      if (!existing) {
        return { success: false, error: "Space not found." };
      }
      if (!managedBuildingIds.includes(existing.buildingId)) {
        return { success: false, error: "Permission denied." };
      }
    }

    const updateData: Prisma.SpaceUncheckedUpdateInput = {
      ...(data as unknown as Prisma.SpaceUncheckedUpdateInput),
      ...(!isSuperAdmin
        ? {
            status: "Pending",
            rejectionReason: null,
            approvedById: null,
          }
        : {
            status: "Active",
            rejectionReason: null,
            approvedById: currentUser.id,
          }),
    };

    const updatedSpace = await databaseService.updateSpace(id, updateData);
    revalidatePath("/admin/spaces");
    // Convert Decimal fields to numbers before returning to the client
    const serializableSpace = {
      ...updatedSpace,
      area: Number(updatedSpace.area),
      utilityProrationShare: Number(updatedSpace.utilityProrationShare),
      monthlyRentalPrice: Number(updatedSpace.monthlyRentalPrice),
    };
    return { success: true, space: serializableSpace };
  } catch (error: any) {
    console.error("Error updating space:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return {
          success: false,
          error: "Failed to update space. Record not found.",
        };
      }
      if (error.code === "P2002") {
        return {
          success: false,
          error:
            "A space with this ID/Name already exists in the selected building. Please use a unique name.",
        };
      }
    }
    return {
      success: false,
      error: error.message || "Failed to update space.",
    };
  }
}

export async function deleteSpaceAction(id: string) {
  try {
    const { isSuperAdmin, permissions, managedBuildingIds } =
      await getUserAndManagedIds();
    if (!isSuperAdmin && !permissions.has("space:delete")) {
      return { success: false, error: "Access Denied" };
    }

    // Fetch the space with all its agreements and tenant info
    const space = await databaseService.getSpaceById(id, {
      agreements: true, // Fetch all agreements
      tenant: true,
    });

    if (!space) {
      return { success: false, error: "Space not found." };
    }

    if (!isSuperAdmin && managedBuildingIds) {
      if (!managedBuildingIds.includes(space.buildingId)) {
        return { success: false, error: "Permission denied." };
      }
    }

    if (space.isOccupied) {
      return {
        success: false,
        error:
          "Cannot delete an occupied space. Please vacate the tenant first.",
      };
    }

    // Check for active agreements in application code
    if (space.agreements && space.agreements.length > 0) {
      const activeAgreements = space.agreements.filter((agreement) => {
        // Ensure startDate is a Date object; Prisma typically returns Date objects
        const agreementEndDate = addMonths(
          agreement.startDate,
          agreement.paymentTermMonths,
        );
        return isAfter(agreementEndDate, new Date());
      });
      if (activeAgreements.length > 0) {
        return {
          success: false,
          error:
            "Cannot delete space with active or future agreements. Please resolve agreements first.",
        };
      }
    }

    await databaseService.deleteSpace(id);
    revalidatePath("/admin/spaces");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting space:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return {
          success: false,
          error: "Failed to delete space. Record not found.",
        };
      }
      if (error.code === "P2003") {
        return {
          success: false,
          error:
            "Cannot delete this space as it is referenced by other records (e.g., historical bills via agreements). Consider archiving instead.",
        };
      }
    }
    return {
      success: false,
      error: error.message || "Failed to delete space.",
    };
  }
}

export async function toggleSpaceStatusAction(
  spaceId: string,
  newStatus: BuildingStatus,
  rejectionReason?: string,
) {
  try {
    const { isSuperAdmin, permissions, currentUser, managedBuildingIds } =
      await getUserAndManagedIds();

    if (newStatus === "Active" || newStatus === "Rejected") {
      if (!isSuperAdmin && !permissions.has("space:approve")) {
        return { success: false, error: "Access Denied" };
      }
    }

    if (newStatus === "Inactive") {
      if (!isSuperAdmin && !permissions.has("space:edit")) {
        return { success: false, error: "Access Denied" };
      }
    }

    const space = await databaseService.getSpaceById(spaceId, {
      agreements: { take: 1 },
    });
    if (!space) {
      return { success: false, error: "Space not found." };
    }

    if (!isSuperAdmin && managedBuildingIds) {
      if (!managedBuildingIds.includes(space.buildingId)) {
        return { success: false, error: "Permission denied." };
      }
    }

    if (
      (newStatus === "Inactive" || newStatus === "Rejected") &&
      space.isOccupied
    ) {
      return {
        success: false,
        error: "Cannot change status while space is occupied.",
      };
    }

    const updateData: Prisma.SpaceUpdateInput = { status: newStatus };
    if (newStatus === "Active") {
      updateData.approvedBy = { connect: { id: currentUser.id } };
      updateData.rejectionReason = null;
    }
    if (newStatus === "Rejected") {
      updateData.approvedBy = { connect: { id: currentUser.id } };
      updateData.rejectionReason = rejectionReason || null;
    }
    if (newStatus === "Inactive") {
      updateData.rejectionReason = null;
    }

    const updatedSpace = await databaseService.updateSpace(spaceId, updateData);
    revalidatePath("/admin/spaces");
    return { success: true, space: updatedSpace };
  } catch (error: any) {
    console.error(`Error changing space status for ${spaceId}:`, error);
    return {
      success: false,
      error: error.message || `Failed to set space status to ${newStatus}.`,
    };
  }
}
