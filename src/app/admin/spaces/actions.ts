
"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import type { Prisma } from '@prisma/client';

export async function createSpaceAction(data: Prisma.SpaceCreateInput) {
  try {
    // Client-side form now ensures utilityProrationShare is a decimal (0-1).
    // Redundant server-side normalization for string or >1 values removed.
    // Prisma expects a Float, which the client provides.

    const newSpace = await databaseService.createSpace(data);
    revalidatePath('/admin/spaces');
    return { success: true, space: newSpace };
  } catch (error: any) {
    console.error("Error creating space:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') { // Unique constraint violation (e.g., spaceIdName in building)
        return { success: false, error: `Failed to create space. A space with ID '${data.spaceIdName}' might already exist in building '${data.buildingName}'.` };
      }
    }
    return { success: false, error: error.message || "Failed to create space." };
  }
}

export async function updateSpaceAction(id: string, data: Prisma.SpaceUpdateInput) {
  try {
    // Client-side form now ensures utilityProrationShare is a decimal (0-1).
    // Redundant server-side normalization for string or >1 values removed.
    // Prisma expects a Float, which the client provides.

    const updatedSpace = await databaseService.updateSpace(id, data);
    revalidatePath('/admin/spaces');
    return { success: true, space: updatedSpace };
  } catch (error: any) {
    console.error("Error updating space:", error);
     if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return { success: false, error: `Failed to update space. A space with similar unique fields might already exist.` };
      }
      if (error.code === 'P2025') { // Record to update not found
        return { success: false, error: "Failed to update space. Record not found." };
      }
    }
    return { success: false, error: error.message || "Failed to update space." };
  }
}

export async function deleteSpaceAction(id: string) {
  try {
    const space = await databaseService.getSpaceById(id, { 
      include: { 
        agreements: { where: { endDate: { gte: new Date() } } }, // Check for active/future agreements
        tenant: true 
      } 
    });

    if (space?.isOccupied) {
        return { success: false, error: "Cannot delete an occupied space. Please vacate the tenant first." };
    }
    if (space?.agreements && space.agreements.length > 0) {
        return { success: false, error: "Cannot delete space with active or future agreements. Please resolve agreements first." };
    }

    await databaseService.deleteSpace(id);
    revalidatePath('/admin/spaces');
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting space:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { // Record to delete not found
        return { success: false, error: "Failed to delete space. Record not found." };
      }
       // P2003: Foreign key constraint failed on the field (e.g. if a Bill references an Agreement linked to this space)
       // This might be too restrictive if agreements are old. The check above is more specific.
      if (error.code === 'P2003') {
         return { success: false, error: "Cannot delete this space as it is referenced by other records (e.g., historical bills via agreements). Consider archiving instead." };
      }
    }
    return { success: false, error: error.message || "Failed to delete space." };
  }
}
