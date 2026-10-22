import type { Prisma, PrismaClient } from '@prisma/client';
export declare function recomputeCustomerVerification(tx: Prisma.TransactionClient | PrismaClient, userId: string, now?: Date): Promise<{
    isVerified: boolean;
    dlValidUntil: Date | null;
}>;
