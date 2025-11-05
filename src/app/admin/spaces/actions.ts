
"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import { Prisma } from '@prisma/client';
import { addMonths, isAfter } from 'date-fns'; // Import date-fns functions

export async function createSpaceAction(data: Prisma.SpaceCreateInput) {
  try {
    const newSpace = await databaseService.createSpace(data);
    revalidatePath('/admin/spaces');
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
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { success: false, error: "A space with this ID/Name already exists in the selected building. Please use a unique name." };
    }
    return { success: false, error: error.message || "Failed to create space." };
  }
}

export async function updateSpaceAction(id: string, data: Prisma.SpaceUpdateInput) {
  try {
    const updatedSpace = await databaseService.updateSpace(id, data);
    revalidatePath('/admin/spaces');
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
      if (error.code === 'P2025') { 
        return { success: false, error: "Failed to update space. Record not found." };
      }
      if (error.code === 'P2002') {
        return { success: false, error: "A space with this ID/Name already exists in the selected building. Please use a unique name." };
      }
    }
    return { success: false, error: error.message || "Failed to update space." };
  }
}

export async function deleteSpaceAction(id: string) {
  try {
    // Fetch the space with all its agreements and tenant info
    const space = await databaseService.getSpaceById(id, {
      agreements: true, // Fetch all agreements
      tenant: true
    });

    if (!space) {
      return { success: false, error: "Space not found." };
    }

    if (space.isOccupied) {
        return { success: false, error: "Cannot delete an occupied space. Please vacate the tenant first." };
    }

    // Check for active agreements in application code
    if (space.agreements && space.agreements.length > 0) {
      const activeAgreements = space.agreements.filter(agreement => {
        // Ensure startDate is a Date object; Prisma typically returns Date objects
        const agreementEndDate = addMonths(agreement.startDate, agreement.paymentTermMonths);
        return isAfter(agreementEndDate, new Date());
      });
      if (activeAgreements.length > 0) {
        return { success: false, error: "Cannot delete space with active or future agreements. Please resolve agreements first." };
      }
    }

    await databaseService.deleteSpace(id);
    revalidatePath('/admin/spaces');
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting space:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') { 
        return { success: false, error: "Failed to delete space. Record not found." };
      }
      if (error.code === 'P2003') {
         return { success: false, error: "Cannot delete this space as it is referenced by other records (e.g., historical bills via agreements). Consider archiving instead." };
      }
    }
    return { success: false, error: error.message || "Failed to delete space." };
  }
}
