import type { Prisma, PrismaClient } from '@prisma/client';
export declare const APPROVAL_STATUSES: readonly ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED"];
export declare const AVAILABILITY_STATES: readonly ["ACTIVE", "INACTIVE"];
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];
export type Availability = (typeof AVAILABILITY_STATES)[number];
export declare const ADMINISTRATIVE_RESTRICTIONS: readonly ["ADMIN_SUSPENDED", "MAINTENANCE", "REVIEW_REQUIRED"];
export declare const REVOCATION_HOLD: {
    readonly approvalStatus: "PENDING_APPROVAL";
    readonly availability: "INACTIVE";
    readonly availabilityReason: "REVIEW_REQUIRED";
    readonly status: "PENDING_APPROVAL";
};
export declare function isAdministrativeRestriction(reason: string | null | undefined): boolean;
export declare const REQUIRED_VEHICLE_DOCUMENTS: readonly ["RC", "INSURANCE", "PUC"];
export declare const UNVERIFIED_DOCUMENT_SOURCES: string[];
export declare function demoVerificationEnabled(env?: Record<string, string | undefined>): boolean;
export declare function unverifiedDocumentSources(): string[];
export declare function assertDemoVerificationAllowed(env?: Record<string, string | undefined>): void;
export declare function legacyVehicleStatus(approval: string, availability: string, reason?: string | null): 'ACTIVE' | 'PENDING_APPROVAL' | 'INACTIVE' | 'MAINTENANCE';
export declare function compliantDocumentWhere(kind: string, until: Date): {
    mediaId: {
        not: null;
    };
    source: {
        notIn: string[];
    };
    kind: string;
    status: string;
    validUntil: {
        gte: Date;
    };
} | {
    OR: ({
        mediaId: {
            not: null;
        };
        source: {
            notIn: string[];
        };
    } | {
        source: string;
    })[];
    kind: string;
    status: string;
    validUntil: {
        gte: Date;
    };
};
export declare function bookableVehicleWhere(until: Date): {
    approvalStatus: string;
    availability: string;
    AND: {
        documents: {
            some: {
                mediaId: {
                    not: null;
                };
                source: {
                    notIn: string[];
                };
                kind: string;
                status: string;
                validUntil: {
                    gte: Date;
                };
            } | {
                OR: ({
                    mediaId: {
                        not: null;
                    };
                    source: {
                        notIn: string[];
                    };
                } | {
                    source: string;
                })[];
                kind: string;
                status: string;
                validUntil: {
                    gte: Date;
                };
            };
        };
    }[];
};
type Doc = {
    kind: string;
    status: string;
    mediaId: string | null;
    source: string | null;
    validUntil: Date | null;
};
export type EligibilityReason = string;
export declare function vehicleEligibility(vehicle: {
    approvalStatus: string;
    availability: string;
    documents: Doc[];
}, until?: Date, now?: Date): {
    bookable: boolean;
    reasons: string[];
};
export declare function eligibilityMessage(reasons: EligibilityReason[]): "This car is not available for booking right now." | "This car’s documents do not remain valid through your return date. Choose an earlier return date or another car." | "This car is not available for booking until its documents are verified.";
export declare function upcomingBookingWhere(now?: Date): {
    OR: ({
        status: "CONFIRMED";
        startDate: {
            gt: Date;
        };
        expiresAt?: undefined;
    } | {
        status: "PENDING";
        expiresAt: {
            gt: Date;
        };
        startDate?: undefined;
    })[];
};
export declare function flagUpcomingBookings(tx: Prisma.TransactionClient | PrismaClient, vehicleId: string, reason: string, actorId: string, now?: Date): Promise<number>;
export {};
