import { PrismaService } from '../prisma/prisma.service';
export declare class WalletService {
    private prisma;
    constructor(prisma: PrismaService);
    getBalance(userId: string): Promise<{
        id: string;
        updatedAt: Date;
        userId: string;
        balance: import("@prisma/client-runtime-utils").Decimal;
    }>;
    deposit(_userId: string, _amount: number): Promise<void>;
}
