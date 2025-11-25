
"use server";

import { databaseService } from '@/lib/services/databaseService';
import { getUserAndManagedIds } from '@/lib/actions/server-helpers';
import type { AuditLog, Prisma } from '@prisma/client';

export type SerializedAuditLog = Omit<AuditLog, 'createdAt' | 'paymentDate' | 'rentAmount' | 'utilityAmount' | 'penaltyAmount' | 'totalAmount'> & {
    createdAt: string;
    paymentDate: string;
    rentAmount: number;
    utilityAmount: number;
    penaltyAmount: number;
    totalAmount: number;
};

export async function getAuditLogDataAction(): Promise<SerializedAuditLog[]> {
    try {
        const { isSuperAdmin, managedBuildingIds } = await getUserAndManagedIds();

        if (!isSuperAdmin && managedBuildingIds?.length === 0) {
            return [];
        }

        const whereClause: Prisma.AuditLogWhereInput = !isSuperAdmin
            ? { buildingId: { in: managedBuildingIds! } }
            : {};
        
        const logs = await databaseService.getAllAuditLogs({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
        });

        // Serialize data before returning to the client
        return logs.map(log => ({
            ...log,
            createdAt: log.createdAt.toISOString(),
            paymentDate: log.paymentDate.toISOString(),
            rentAmount: Number(log.rentAmount),
            utilityAmount: Number(log.utilityAmount),
            penaltyAmount: Number(log.penaltyAmount),
            totalAmount: Number(log.totalAmount),
        }));

    } catch (error) {
        console.error("Error fetching audit log data:", error);
        return [];
    }
}
