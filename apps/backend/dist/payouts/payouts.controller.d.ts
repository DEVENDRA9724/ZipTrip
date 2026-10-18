import { PayoutsService } from './payouts.service';
export declare class PayoutsController {
    private readonly payouts;
    constructor(payouts: PayoutsService);
    account(req: any): Promise<({
        payouts: {
            id: string;
            createdAt: Date;
            status: string;
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
        createdAt: Date;
        updatedAt: Date;
        status: string;
        userId: string;
        accountHolderName: string;
        bankName: string;
        accountNumberLast4: string;
        ifscCode: string;
        encryptedAccountNumber: string;
    }) | null>;
    saveAccount(req: any, body: any): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        userId: string;
        accountHolderName: string;
        bankName: string;
        accountNumberLast4: string;
        ifscCode: string;
    }>;
    list(req: any): Promise<{
        id: string;
        createdAt: Date;
        status: string;
        amount: import("@prisma/client-runtime-utils").Decimal;
        note: string | null;
        accountId: string;
        reference: string | null;
        periodStart: Date | null;
        periodEnd: Date | null;
        processedAt: Date | null;
    }[]>;
    accounts(req: any): Promise<({
        user: {
            email: string;
            firstName: string;
            lastName: string;
            role: import("@prisma/client").$Enums.Role;
        };
        payouts: {
            id: string;
            createdAt: Date;
            status: string;
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
        createdAt: Date;
        updatedAt: Date;
        status: string;
        userId: string;
        accountHolderName: string;
        bankName: string;
        accountNumberLast4: string;
        ifscCode: string;
        encryptedAccountNumber: string;
    })[]>;
    create(req: any, body: any): Promise<{
        account: {
            accountHolderName: string;
            accountNumberLast4: string;
            ifscCode: string;
        };
    } & {
        id: string;
        createdAt: Date;
        status: string;
        amount: import("@prisma/client-runtime-utils").Decimal;
        note: string | null;
        accountId: string;
        reference: string | null;
        periodStart: Date | null;
        periodEnd: Date | null;
        processedAt: Date | null;
    }>;
    status(req: any, id: string, body: any): Promise<{
        id: string;
        createdAt: Date;
        status: string;
        amount: import("@prisma/client-runtime-utils").Decimal;
        note: string | null;
        accountId: string;
        reference: string | null;
        periodStart: Date | null;
        periodEnd: Date | null;
        processedAt: Date | null;
    }>;
    accountStatus(req: any, id: string, body: any): Promise<{
        id: string;
        status: string;
        userId: string;
        accountHolderName: string;
        bankName: string;
        accountNumberLast4: string;
        ifscCode: string;
    }>;
}
