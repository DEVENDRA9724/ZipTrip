import { PrismaService } from '../prisma/prisma.service';
export declare class WalletService {
    private prisma;
    constructor(prisma: PrismaService);
    getBalance(userId: string): Promise<{
        id: string;
        updatedAt: Date;
        balance: import("@prisma/client-runtime-utils").Decimal;
        userId: string;
    }>;
    deposit(_userId: string, _amount: number): Promise<void>;
}
