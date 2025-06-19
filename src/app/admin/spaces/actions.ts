
"use server";

import { revalidatePath } from 'next/cache';
import { databaseService } from '@/lib/services/databaseService';
import type { Prisma } from '@prisma/client';

export async function createSpaceAction(data: Prisma.SpaceCreateInput) {
  try {
    const newSpace = await databaseService.createSpace(data);
    revalidatePath('/admin/spaces');
    return { success: true, space: newSpace };
  } catch (error: any) {
    console.error("Error creating space:", error);
    return { success: false, error: error.message || "Failed to create space." };
  }
}

export async function updateSpaceAction(id: string, data: Prisma.SpaceUpdateInput) {
  try {
    const updatedSpace = await databaseService.updateSpace(id, data);
    revalidatePath('/admin/spaces');
    return { success: true, space: updatedSpace };
  } catch (error: any) {
    console.error("Error updating space:", error);
    return { success: false, error: error.message || "Failed to update space." };
  }
}

export async function deleteSpaceAction(id: string) {
  try {
    // Add any pre-deletion checks here, e.g., if space is occupied by an active agreement.
    const space = await databaseService.getSpaceById(id, { include: { agreements: true, tenant: true } });
    if (space?.isOccupied || (space?.agreements && space.agreements.length > 0)) {
        // A more robust check would be to see if agreements are active.
        return { success: false, error: "Cannot delete space that is occupied or has associated agreements. Please ensure it's vacant and agreements are resolved." };
    }
    await databaseService.deleteSpace(id);
    revalidatePath('/admin/spaces');
    return { success: true };
  } catch (error: any)
