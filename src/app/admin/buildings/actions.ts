"use server";

import { revalidatePath } from "next/cache";
import { databaseService } from "@/lib/services/databaseService";
import { Prisma, type User, type Role, BuildingStatus } from "@prisma/client";
import { cookies } from "next/headers";
import { getUserAndPermissions } from "@/lib/actions/server-helpers";
import { prisma } from "@/lib/prisma";

export async function createBuildingAction(
  data: Omit<Prisma.BuildingCreateInput, "createdBy" | "approvedBy">,
) {
  try {
    const { currentUser, isSuperAdmin } = await getUserAndPermissions();
    if (!currentUser) {
      return { success: false, error: "User session not found." };
    }

    // A user who creates a building should automatically be a manager of it.
    // Additionally, when a non-super-admin Maker creates a building, we
    // auto-assign all users who have the "building:approve" permission
    // (the Checkers) as managers so they can approve/manage the building.
    const managerConnect: { id: string }[] = [{ id: currentUser.id }];

    if (!isSuperAdmin) {
      try {
        const approvers = await prisma.user.findMany({
          where: {
            roles: {
              some: {
                permissions: { has: "building:approve" },
              },
            },
          },
          select: { id: true },
        });
        for (const a of approvers) {
          if (a.id !== currentUser.id) managerConnect.push({ id: a.id });
        }
      } catch (err) {
        // If the lookup fails for any reason, fall back to assigning only the creator.
        console.error("Error fetching approvers for building assignment:", err);
      }
    }

    const buildingCreateInput: Prisma.BuildingCreateInput = {
      ...data,
      status: isSuperAdmin ? "Active" : "Pending", // Auto-approve for Super Admins
      createdBy: {
        connect: { id: currentUser.id },
      },
      managers: {
        connect: managerConnect,
      },
      ...(isSuperAdmin && { approvedBy: { connect: { id: currentUser.id } } }),
    };

    const newBuilding = await databaseService.createBuilding(
      buildingCreateInput,
    );
    revalidatePath("/admin/buildings");
    return { success: true, building: newBuilding };
  } catch (error: any) {
    console.error("Error creating building:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        const target = (error.meta?.target as string[]) || [];
        if (target.includes("name")) {
          return {
            success: false,
            error:
              "A building with this name already exists. Please use a unique name.",
          };
        }
        return {
          success: false,
          error:
            "A building with this name or other unique field already exists.",
        };
      }
    }
    return {
      success: false,
      error: error.message || "Failed to create building.",
    };
  }
}

export async function updateBuildingAction(
  id: string,
  data: Prisma.BuildingUpdateInput,
  managerIds?: string[],
) {
  try {
    // This is the correct way to handle relation updates in Prisma
    if (managerIds !== undefined) {
      data.managers = {
        set: managerIds.map((id) => ({ id })),
      };
    }

    const updatedBuilding = await databaseService.updateBuilding(id, data);
    revalidatePath("/admin/buildings");
    revalidatePath(`/admin/buildings/add-building?id=${id}`);
    revalidatePath("/admin/settings/user-management");
    return { success: true, building: updatedBuilding };
  } catch (error: any) {
    console.error("Error updating building:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return {
          success: false,
          error: "Failed to update building. Record not found.",
        };
      }
      if (error.code === "P2002") {
        const target = (error.meta?.target as string[]) || [];
        if (target.includes("name")) {
          return {
            success: false,
            error:
              "A building with this name already exists. Please use a unique name.",
          };
        }
        return {
          success: false,
          error: "This building's name conflicts with an existing building.",
        };
      }
    }
    return {
      success: false,
      error: error.message || "Failed to update building.",
    };
  }
}

export async function toggleBuildingStatusAction(
  buildingId: string,
  newStatus: BuildingStatus,
  rejectionReason?: string,
) {
  try {
    const { permissions, isSuperAdmin, currentUser } =
      await getUserAndPermissions();
    if (newStatus === "Active" || newStatus === "Rejected") {
      if (
        !isSuperAdmin &&
        !permissions.has("building:approve") &&
        !permissions.has("building:status")
      ) {
        return { success: false, error: "Access Denied" };
      }
    }

    if (newStatus === "Inactive") {
      if (
        !isSuperAdmin &&
        !permissions.has("building:edit") &&
        !permissions.has("building:status")
      ) {
        return { success: false, error: "Access Denied" };
      }
      const buildingWithSpaces = await databaseService.getBuildingById(
        buildingId,
        { spaces: { where: { isOccupied: true }, take: 1 } },
      );
      if (buildingWithSpaces && buildingWithSpaces.spaces.length > 0) {
        return {
          success: false,
          error:
            "Cannot deactivate a building with occupied spaces. Please ensure all spaces are vacant first.",
        };
      }
    }

    const updateData: Prisma.BuildingUpdateInput = { status: newStatus };
    if (newStatus === "Active") {
      updateData.approvedBy = { connect: { id: currentUser.id } };
      updateData.rejectionReason = null;
    }
    if (newStatus === "Rejected") {
      updateData.rejectionReason = rejectionReason;
    }

    const updatedBuilding = await databaseService.updateBuilding(
      buildingId,
      updateData,
    );
    revalidatePath("/admin/buildings");
    return { success: true, building: updatedBuilding };
  } catch (error: any) {
    console.error(`Error changing building status for ${buildingId}:`, error);
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return { success: false, error: "Building not found." };
    }
    return {
      success: false,
      error: `Failed to set building status to ${newStatus}.`,
    };
  }
}
