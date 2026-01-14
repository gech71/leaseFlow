"use server";

import { revalidatePath } from "next/cache";
import { databaseService } from "@/lib/services/databaseService";
import { Prisma, type User, type Role } from "@prisma/client";
import { cookies, headers } from "next/headers";
import {
  getUserAndPermissions,
  getUserAndManagedIds,
} from "@/lib/actions/server-helpers";
import { GENERIC_NEUTRAL_ERROR } from "@/lib/security/messages";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const ADMIN_ACCESS_TOKEN_KEY = "nibrental_admin_access_token";

export async function getUserManagementPageData() {
  try {
    const { isSuperAdmin, managedBuildingIds, currentUser } =
      await getUserAndManagedIds();

    let userWhereClause: Prisma.UserWhereInput = {};

    // Non-superadmins can see users they created and tenants in buildings they manage
    if (!isSuperAdmin) {
      const createdUserIds = (
        await prisma.user.findMany({
          where: { createdById: currentUser.id },
          select: { id: true },
        })
      ).map((u) => u.id);

      // Users registered by *other* users are only visible if both users belong
      // to the same building. For staff/admin accounts, we model "belonging" as
      // being assigned to manage at least one common building.
      const staffUserIdsInManagedBuildings =
        managedBuildingIds && managedBuildingIds.length > 0
          ? (
              await prisma.user.findMany({
                where: {
                  managedBuildings: {
                    some: { id: { in: managedBuildingIds } },
                  },
                },
                select: { id: true },
              })
            ).map((u) => u.id)
          : [];

      const tenantUserIdsInManagedBuildings = (
        await prisma.tenant.findMany({
          where: {
            agreements: {
              some: {
                space: {
                  buildingId: { in: managedBuildingIds ?? [] },
                },
              },
            },
          },
          select: { userId: true },
        })
      )
        .map((t) => t.userId)
        .filter((id): id is string => !!id);

      const allVisibleUserIds = [
        ...new Set([
          ...createdUserIds,
          ...staffUserIdsInManagedBuildings,
          ...tenantUserIdsInManagedBuildings,
        ]),
      ];

      // Super Admin users must not be visible to non-super-admins.
      userWhereClause = {
        AND: [
          { id: { in: allVisibleUserIds } },
          { roles: { none: { name: "SUPER_ADMIN" } } },
        ],
      };
    }

    const users = await databaseService.getAllUsers({
      where: userWhereClause,
      include: {
        roles: true,
        managedBuildings: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Apply role filtering logic
    let roleWhereClause: Prisma.RoleWhereInput = {};
    if (!isSuperAdmin) {
      // Normal users can only assign roles they have created, plus the TENANT role.
      // If the user has `canSeeSuperAdminRoles`, also include roles created by Super Admin users
      // (but always exclude the SUPER_ADMIN role itself).
      const canSeeSuperAdminRoles = !!(currentUser as any)
        .canSeeSuperAdminRoles;

      const orClauses: Prisma.RoleWhereInput[] = [
        {
          name: { notIn: ["SUPER_ADMIN"] },
          createdById: currentUser.id,
        },
        {
          name: "TENANT",
        },
      ];

      if (canSeeSuperAdminRoles) {
        orClauses.push({
          name: { not: "SUPER_ADMIN" },
          createdBy: { roles: { some: { name: "SUPER_ADMIN" } } },
        });
      }

      roleWhereClause = { OR: orClauses };
    }
    const allRoles = await databaseService.getAllRoles({
      where: roleWhereClause,
      orderBy: { name: "asc" },
    });

    // Non-super-admins should only see the buildings they can manage to assign
    const buildingWhereClause: Prisma.BuildingWhereInput = !isSuperAdmin
      ? { id: { in: managedBuildingIds ?? [] } }
      : {};
    const allBuildings = await databaseService.getAllBuildings({
      where: buildingWhereClause,
      orderBy: { name: "asc" },
    });

    return { success: true, users, allRoles, allBuildings };
  } catch (error: any) {
    console.error("Error fetching user management data:", error);
    return {
      success: false,
      error: GENERIC_NEUTRAL_ERROR,
      users: [],
      allRoles: [],
      allBuildings: [],
    };
  }
}

export async function updateUserAssignments(
  targetUserId: string,
  selectedRoleId: string | null,
  selectedManagedBuildingIds: string[],
  seeSuperAdminRoles?: boolean,
  assignBuildings?: boolean,
) {
  try {
    // Get the current user and managed building ids to enforce scoping.
    const { isSuperAdmin, permissions, managedBuildingIds, currentUser } =
      await getUserAndManagedIds();
    if (!isSuperAdmin && !permissions.has("settings:user_management:assign")) {
      return { success: false, error: "Permission denied." };
    }

    const canAssignBuildings =
      isSuperAdmin || !!(currentUser as any).canAssignBuildings;

    const updateData: Prisma.UserUpdateInput = {
      roles: selectedRoleId ? { set: [{ id: selectedRoleId }] } : { set: [] },
    };

    // If we are assigning a role, we may want to auto-assign buildings for makers.
    let rolePermissions: string[] = [];
    let targetUser: { email: string; phoneNumber: string } | null = null;
    if (selectedRoleId) {
      const [role, user] = await Promise.all([
        prisma.role.findUnique({
          where: { id: selectedRoleId },
          select: { permissions: true },
        }),
        prisma.user.findUnique({
          where: { id: targetUserId },
          select: { email: true, phoneNumber: true },
        }),
      ]);
      rolePermissions = role?.permissions ?? [];
      targetUser = user;
    }

    const isBuildingMaker = rolePermissions.includes("building:create");
    const isBuildingChecker = rolePermissions.includes("building:approve");
    const isMakerAndChecker = isBuildingMaker && isBuildingChecker;

    // If no buildings were explicitly selected and the assigned role has both maker & checker
    // permissions, default to ALL buildings.
    // Otherwise, for building makers, auto-assign buildings where the target user matches
    // the building owner.
    let resolvedManagedBuildingIds = selectedRoleId
      ? selectedManagedBuildingIds
      : [];
    if (selectedRoleId && resolvedManagedBuildingIds.length === 0) {
      if (isMakerAndChecker) {
        const all = await prisma.building.findMany({ select: { id: true } });
        resolvedManagedBuildingIds = all.map((b) => b.id);
      } else if (isBuildingMaker && targetUser) {
        const matched = await prisma.building.findMany({
          where: {
            OR: [
              { ownerEmail: targetUser.email },
              { ownerPhone: targetUser.phoneNumber },
            ],
          },
          select: { id: true },
        });
        resolvedManagedBuildingIds = matched.map((b) => b.id);
      }
    }

    // If the caller is a super-admin they can explicitly set managed buildings.
    // For non-super-admins, when they assign a role to a user we automatically
    // assign the caller's managed buildings by default (or use the explicit
    // `selectedManagedBuildingIds` if provided).
    let finalManagedBuildingIds: string[] = [];
    if (canAssignBuildings) {
      // Non-super-admins can only assign buildings within their own managed scope.
      if (!isSuperAdmin) {
        const allowed = new Set(managedBuildingIds ?? []);
        const disallowed = resolvedManagedBuildingIds.filter(
          (id) => !allowed.has(id),
        );
        if (disallowed.length > 0) {
          return {
            success: false,
            error: "You can only assign buildings you manage.",
          };
        }
      }

      finalManagedBuildingIds = resolvedManagedBuildingIds;
      updateData.managedBuildings = {
        set: resolvedManagedBuildingIds.map((id) => ({ id })),
      };

      if (isSuperAdmin) {
        // Allow super-admin to set delegated flags
        if (typeof seeSuperAdminRoles !== "undefined") {
          (updateData as any).canSeeSuperAdminRoles = seeSuperAdminRoles;
        }
        if (typeof assignBuildings !== "undefined") {
          (updateData as any).canAssignBuildings = assignBuildings;
        }
      }
    } else {
      // If a role is being assigned, attach the caller's managed buildings
      // unless an explicit list is provided.
      if (selectedRoleId) {
        const targetIds =
          resolvedManagedBuildingIds && resolvedManagedBuildingIds.length > 0
            ? resolvedManagedBuildingIds
            : managedBuildingIds ?? [];
        finalManagedBuildingIds = targetIds;
        updateData.managedBuildings = { set: targetIds.map((id) => ({ id })) };
      } else {
        // No role selected -> clear managed buildings for the target user
        finalManagedBuildingIds = [];
        updateData.managedBuildings = { set: [] };
      }
    }

    // Non-super-admin callers are not allowed to set delegated flags.
    // Ignore any client-provided values for these flags unless caller is SUPER_ADMIN.

    await prisma.user.update({
      where: { id: targetUserId },
      data: updateData,
    });

    revalidatePath("/admin/settings/user-management");
    revalidatePath("/admin/buildings");
    return {
      success: true,
      message: "User assignments updated successfully.",
      assignedManagedBuildingIds: finalManagedBuildingIds,
    };
  } catch (error: any) {
    console.error("Error updating user assignments:", error);
    return { success: false, error: GENERIC_NEUTRAL_ERROR };
  }
}

export async function updateUserNamesAction(
  userId: string,
  data: {
    firstName: string;
    lastName: string;
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    const { isSuperAdmin, permissions } = await getUserAndPermissions();
    if (!isSuperAdmin && !permissions.has("settings:user_management:assign")) {
      return { success: false, error: "Permission denied." };
    }

    await databaseService.updateUser(userId, {
      firstName: data.firstName,
      lastName: data.lastName,
      name: `${data.firstName} ${data.lastName}`.trim(),
    });

    const localUserToUpdate = await databaseService.getUserById(userId);
    if (localUserToUpdate) {
      const tenantProfile = await databaseService.findTenantByEmailOrPhone(
        localUserToUpdate.email,
        localUserToUpdate.phoneNumber,
      );
      if (tenantProfile) {
        await databaseService.updateTenant(tenantProfile.id, {
          name: `${data.firstName} ${data.lastName}`.trim(),
        });
      }
    }

    revalidatePath("/admin/settings/user-management");
    return { success: true };
  } catch (error: any) {
    console.error("Error in updateUserNamesAction:", error);
    return { success: false, error: GENERIC_NEUTRAL_ERROR };
  }
}

export async function changeUserPhoneNumberAction(
  userId: string,
  newPhoneNumber: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { isSuperAdmin, permissions } = await getUserAndPermissions();
    if (!isSuperAdmin && !permissions.has("settings:user_management:assign")) {
      return { success: false, error: "Permission denied." };
    }

    const userToUpdate = await databaseService.getUserById(userId);
    if (!userToUpdate) {
      return { success: false, error: GENERIC_NEUTRAL_ERROR };
    }

    await databaseService.updateUser(userId, {
      phoneNumber: newPhoneNumber,
    });

    const tenantProfile = await databaseService.findTenantByEmailOrPhone(
      null,
      userToUpdate.phoneNumber,
    );
    if (tenantProfile) {
      await databaseService.updateTenant(tenantProfile.id, {
        phone: newPhoneNumber,
      });
    }

    revalidatePath("/admin/settings/user-management");
    return { success: true };
  } catch (error: any) {
    console.error("Error in changeUserPhoneNumberAction:", error);
    return { success: false, error: GENERIC_NEUTRAL_ERROR };
  }
}

export async function changeUserEmailAction(
  userId: string,
  newEmail: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { isSuperAdmin, permissions } = await getUserAndPermissions();
    if (!isSuperAdmin && !permissions.has("settings:user_management:assign")) {
      return { success: false, error: "Permission denied." };
    }

    // Check for existing user with the new email
    const existing = await databaseService.findUserByEmailOrPhone(
      newEmail,
      null,
    );
    if (existing && existing.id !== userId) {
      return {
        success: false,
        error: "Email is already in use by another user.",
      };
    }

    const userToUpdate = await databaseService.getUserById(userId);
    if (!userToUpdate) return { success: false, error: "User not found." };

    await databaseService.updateUser(userId, { email: newEmail });

    // If there's a tenant profile linked by the old email/phone, update it
    const tenantProfile = await databaseService.findTenantByEmailOrPhone(
      userToUpdate.email,
      userToUpdate.phoneNumber,
    );
    if (tenantProfile) {
      await databaseService.updateTenant(tenantProfile.id, { email: newEmail });
    }

    revalidatePath("/admin/settings/user-management");
    return { success: true };
  } catch (error: any) {
    console.error("Error in changeUserEmailAction:", error);
    return { success: false, error: GENERIC_NEUTRAL_ERROR };
  }
}

function generateTempPassword(length = 12): string {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";
  const allChars = upper + lower + numbers + symbols;

  let password = "";
  const randomValues = new Uint32Array(length);
  crypto.getRandomValues(randomValues);

  // Ensure at least one of each character type
  password += upper[randomValues[0] % upper.length];
  password += lower[randomValues[1] % lower.length];
  password += numbers[randomValues[2] % numbers.length];
  password += symbols[randomValues[3] % symbols.length];

  // Fill the rest of the password
  for (let i = 4; i < length; i++) {
    password += allChars[randomValues[i] % allChars.length];
  }

  // Shuffle the password to avoid predictable patterns
  return password
    .split("")
    .sort(
      () => 0.5 - crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296,
    )
    .join("");
}

export async function resetUserPasswordAction(
  userId: string,
): Promise<{ success: boolean; tempPassword?: string; error?: string }> {
  try {
    const { isSuperAdmin, permissions } = await getUserAndPermissions();
    if (!isSuperAdmin && !permissions.has("settings:user_management:assign")) {
      return { success: false, error: "Permission denied." };
    }

    const tempPassword = generateTempPassword();

    await databaseService.updateUser(userId, {
      password: null, // Remove the main password
      tempPassword: tempPassword, // Store the plain temporary password
    });

    revalidatePath("/admin/settings/user-management");
    return { success: true, tempPassword };
  } catch (error: any) {
    console.error("Error resetting user password:", error);
    return { success: false, error: "Failed to reset password." };
  }
}
