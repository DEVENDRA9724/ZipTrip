import { PrismaService } from '../prisma/prisma.service';
export declare class PayoutsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getAccount(user: {
        id: string;
        role: string;
    }): Promise<({
        payouts: {
            id: string;
            status: string;
            createdAt: Date;
            amount: import("@prisma/client-runtime-utils").Decimal;
            note: string | null;
            accountId: string;
            reference: string | null;
            periodStart: Date | null;
            periodEnd: Date | null;
            processedAt: Date | null;
        }[];
    } & {
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        accountHolderName: string;
        bankName: string;
        accountNumberLast4: string;
        ifscCode: string;
        encryptedAccountNumber: string;
    }) | null>;
    saveAccount(user: {
        id: string;
        role: string;
    }, body: any): Promise<{
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        accountHolderName: string;
        bankName: string;
        accountNumberLast4: string;
        ifscCode: string;
    }>;
    list(user: {
        id: string;
        role: string;
    }): Promise<{
        id: string;
        status: string;
        createdAt: Date;
        amount: import("@prisma/client-runtime-utils").Decimal;
        note: string | null;
        accountId: string;
        reference: string | null;
        periodStart: Date | null;
        periodEnd: Date | null;
        processedAt: Date | null;
    }[]>;
    listAccounts(user: {
        id: string;
        role: string;
    }): Promise<({
        user: {
            email: string;
            firstName: string;
            lastName: string;
            role: import("@prisma/client").$Enums.Role;
        };
        payouts: {
            id: string;
            status: string;
            createdAt: Date;
            amount: import("@prisma/client-runtime-utils").Decimal;
            note: string | null;
            accountId: string;
            reference: string | null;
            periodStart: Date | null;
            periodEnd: Date | null;
            processedAt: Date | null;
        }[];
    } & {
        id: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        accountHolderName: string;
        bankName: string;
        accountNumberLast4: string;
        ifscCode: string;
        encryptedAccountNumber: string;
    })[]>;
    create(user: {
        id: string;
        role: string;
    }, body: any): Promise<{
        account: {
            accountHolderName: string;
            accountNumberLast4: string;
            ifscCode: string;
        };
    } & {
        id: string;
        status: string;
        createdAt: Date;
        amount: import("@prisma/client-runtime-utils").Decimal;
        note: string | null;
        accountId: string;
        reference: string | null;
        periodStart: Date | null;
        periodEnd: Date | null;
        processedAt: Date | null;
    }>;
    updateStatus(user: {
        id: string;
        role: string;
    }, id: string, body: any): Promise<{
        id: string;
        status: string;
        createdAt: Date;
        amount: import("@prisma/client-runtime-utils").Decimal;
        note: string | null;
        accountId: string;
        reference: string | null;
        periodStart: Date | null;
        periodEnd: Date | null;
        processedAt: Date | null;
    }>;
    updateAccountStatus(user: {
        id: string;
        role: string;
    }, id: string, body: any): Promise<{
        id: string;
        status: string;
        userId: string;
        accountHolderName: string;
        bankName: string;
        accountNumberLast4: string;
        ifscCode: string;
    }>;
    private encrypt;
}
