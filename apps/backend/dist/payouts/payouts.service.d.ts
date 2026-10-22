import { PrismaService } from '../prisma/prisma.service';
declare const STATUSES: readonly ["PENDING", "PROCESSING", "PAID", "FAILED", "CANCELLED"];
type PayoutStatus = (typeof STATUSES)[number];
export declare const PAYOUT_TRANSITIONS: Record<PayoutStatus, readonly PayoutStatus[]>;
export declare const DESTINATION: {
    readonly CAPTURED: "CAPTURED";
    readonly RECONCILIATION_REQUIRED: "RECONCILIATION_REQUIRED";
    readonly LEGACY_UNVERIFIED: "LEGACY_UNVERIFIED";
};
type Account = {
    id: string;
    userId: string;
    accountHolderName: string;
    bankName: string;
    accountNumberLast4: string;
    ifscCode: string;
    encryptedAccountNumber: string;
    status: string;
    revision: number;
    fingerprint: string | null;
    changedById: string | null;
    verifiedRevision: number | null;
};
export declare function destinationVerified(account: Pick<Account, 'status' | 'revision' | 'verifiedRevision' | 'fingerprint'>): boolean;
export declare class PayoutsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getAccount(user: {
        id: string;
        role: string;
    }): Promise<{
        verificationCurrent: boolean;
        status: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        reviewedById: string | null;
        revision: number;
        verifiedRevision: number | null;
        accountHolderName: string;
        bankName: string;
        accountNumberLast4: string;
        ifscCode: string;
        changedById: string | null;
        changedAt: Date | null;
        reviewedAt: Date | null;
        payouts: {
            status: string;
            id: string;
            createdAt: Date;
            amount: import("@prisma/client-runtime-utils").Decimal;
            note: string | null;
            accountId: string;
            reference: string | null;
            periodStart: Date | null;
            periodEnd: Date | null;
            processedAt: Date | null;
            destinationState: string;
            destinationAccountHolderName: string | null;
            destinationBankName: string | null;
            destinationIfscCode: string | null;
            destinationAccountNumberLast4: string | null;
            destinationEncryptedAccountNumber: string | null;
            destinationFingerprint: string | null;
            destinationAccountRevision: number | null;
            destinationCapturedAt: Date | null;
        }[];
    } | null>;
    saveAccount(user: {
        id: string;
        role: string;
    }, body: any): Promise<{
        verificationCurrent: boolean;
    }>;
    list(user: {
        id: string;
        role: string;
    }): Promise<{
        status: string;
        id: string;
        createdAt: Date;
        amount: import("@prisma/client-runtime-utils").Decimal;
        note: string | null;
        accountId: string;
        reference: string | null;
        periodStart: Date | null;
        periodEnd: Date | null;
        processedAt: Date | null;
        destinationState: string;
        destinationAccountHolderName: string | null;
        destinationBankName: string | null;
        destinationIfscCode: string | null;
        destinationAccountNumberLast4: string | null;
        destinationAccountRevision: number | null;
        destinationCapturedAt: Date | null;
    }[]>;
    listAccounts(user: {
        id: string;
        role: string;
    }): Promise<{
        verificationCurrent: boolean;
        user: {
            email: string;
            firstName: string;
            lastName: string;
            role: import("@prisma/client").$Enums.Role;
        };
        status: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        reviewedById: string | null;
        revision: number;
        verifiedRevision: number | null;
        accountHolderName: string;
        bankName: string;
        accountNumberLast4: string;
        ifscCode: string;
        changedById: string | null;
        changedAt: Date | null;
        reviewedAt: Date | null;
        payouts: {
            status: string;
            id: string;
            createdAt: Date;
            amount: import("@prisma/client-runtime-utils").Decimal;
            note: string | null;
            accountId: string;
            reference: string | null;
            periodStart: Date | null;
            periodEnd: Date | null;
            processedAt: Date | null;
            destinationState: string;
            destinationAccountHolderName: string | null;
            destinationBankName: string | null;
            destinationIfscCode: string | null;
            destinationAccountNumberLast4: string | null;
            destinationEncryptedAccountNumber: string | null;
            destinationFingerprint: string | null;
            destinationAccountRevision: number | null;
            destinationCapturedAt: Date | null;
        }[];
    }[]>;
    create(user: {
        id: string;
        role: string;
    }, body: any): Promise<any>;
    updateStatus(user: {
        id: string;
        role: string;
    }, id: string, body: any): Promise<{
        status: string;
        id: string;
        createdAt: Date;
        amount: import("@prisma/client-runtime-utils").Decimal;
        note: string | null;
        accountId: string;
        reference: string | null;
        periodStart: Date | null;
        periodEnd: Date | null;
        processedAt: Date | null;
        destinationState: string;
        destinationAccountHolderName: string | null;
        destinationBankName: string | null;
        destinationIfscCode: string | null;
        destinationAccountNumberLast4: string | null;
        destinationAccountRevision: number | null;
        destinationCapturedAt: Date | null;
    }>;
    updateAccountStatus(user: {
        id: string;
        role: string;
    }, id: string, body: any): Promise<{
        verificationCurrent: boolean;
    }>;
    reconcile(user: {
        id: string;
        role: string;
    }, id: string, body: any): Promise<{
        cancelled: {
            status: string;
            id: string;
            createdAt: Date;
            amount: import("@prisma/client-runtime-utils").Decimal;
            note: string | null;
            accountId: string;
            reference: string | null;
            periodStart: Date | null;
            periodEnd: Date | null;
            processedAt: Date | null;
            destinationState: string;
            destinationAccountHolderName: string | null;
            destinationBankName: string | null;
            destinationIfscCode: string | null;
            destinationAccountNumberLast4: string | null;
            destinationAccountRevision: number | null;
            destinationCapturedAt: Date | null;
        };
        replacement: any;
    }>;
    private createWithSnapshot;
    private blockReason;
    private lockAccount;
    private publicAccount;
    private key;
    private encrypt;
    private decrypt;
    private fingerprint;
    private legacyFingerprint;
}
export {};
