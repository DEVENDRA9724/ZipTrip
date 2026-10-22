import { AccountService } from './account.service';
export declare class AccountController {
    private readonly account;
    constructor(account: AccountService);
    dashboard(req: any): Promise<{
        role: string;
        metrics: {
            users: number;
            vehicles: number;
            bookings: number;
            pendingDocuments: number;
            pendingRefunds: number;
            disputes: number;
            totalCollected: number;
            totalPaidBookings: number;
            todayCollected: number;
            todayPaidBookings: number;
        };
    } | {
        role: string;
        profile: {
            id: string;
            email: string;
            phone: string | null;
            phoneVerifiedAt: Date | null;
            firstName: string;
            lastName: string;
            isVerified: boolean;
            profile: {
                id: string;
                firstName: string;
                lastName: string;
                createdAt: Date;
                updatedAt: Date;
                city: string;
                state: string;
                postalCode: string | null;
                aadhaarNumberHash: string | null;
                aadhaarNumberMasked: string | null;
                panNumberHash: string | null;
                panNumberMasked: string | null;
                drivingLicenseHash: string | null;
                drivingLicenseMasked: string | null;
                dlExpiryDate: Date | null;
                profileImageUrl: string | null;
                selfieMediaId: string | null;
                faceMatchScore: number | null;
                faceMatchStatus: string | null;
                isKycVerified: boolean;
                userId: string;
            } | null;
        } | null;
        fleet: {
            total: number;
            active: number;
            pendingApproval: number;
            vehicles: {
                media: {
                    kind: string;
                }[];
                status: import("@prisma/client").$Enums.VehicleStatus;
                id: string;
                documents: {
                    status: string;
                    kind: string;
                    validUntil: Date | null;
                }[];
                year: number;
                make: string;
                model: string;
                pricePerDay: import("@prisma/client-runtime-utils").Decimal;
                locationCity: string;
                registrationNumber: string | null;
                odometer: number;
                approvalStatus: string;
                availability: string;
            }[];
        };
        bookings: ({
            vehicle: {
                make: string;
                model: string;
                registrationNumber: string | null;
            };
            payment: {
                status: string;
                amount: import("@prisma/client-runtime-utils").Decimal;
            } | null;
            customer: {
                phone: string | null;
                firstName: string;
                lastName: string;
            };
            inspections: {
                createdAt: Date;
                stage: string;
            }[];
            settlement: {
                status: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                bookingId: string;
                note: string | null;
                depositHeld: import("@prisma/client-runtime-utils").Decimal;
                automaticCharges: import("@prisma/client-runtime-utils").Decimal;
                damageCharges: import("@prisma/client-runtime-utils").Decimal;
                fuelCharges: import("@prisma/client-runtime-utils").Decimal;
                tollCharges: import("@prisma/client-runtime-utils").Decimal;
                fineCharges: import("@prisma/client-runtime-utils").Decimal;
                cleaningCharges: import("@prisma/client-runtime-utils").Decimal;
                otherCharges: import("@prisma/client-runtime-utils").Decimal;
                totalDeduction: import("@prisma/client-runtime-utils").Decimal;
                refundAmount: import("@prisma/client-runtime-utils").Decimal;
                additionalAmountDue: import("@prisma/client-runtime-utils").Decimal;
                reviewedById: string | null;
            } | null;
        } & {
            status: import("@prisma/client").$Enums.BookingStatus;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            bookingRef: string;
            customerId: string;
            vehicleId: string;
            driverId: string | null;
            pickupHubId: string | null;
            dropoffHubId: string | null;
            startDate: Date;
            endDate: Date;
            tenureHours: number;
            serviceType: string;
            baseFare: import("@prisma/client-runtime-utils").Decimal;
            securityDeposit: import("@prisma/client-runtime-utils").Decimal;
            insuranceFee: import("@prisma/client-runtime-utils").Decimal;
            discountAmount: import("@prisma/client-runtime-utils").Decimal;
            taxAmount: import("@prisma/client-runtime-utils").Decimal;
            platformFee: import("@prisma/client-runtime-utils").Decimal;
            hostRevenue: import("@prisma/client-runtime-utils").Decimal;
            totalAmount: import("@prisma/client-runtime-utils").Decimal;
            expiresAt: Date | null;
            requestKey: string | null;
            dailyRate: import("@prisma/client-runtime-utils").Decimal;
            rentalDays: number;
            includedKilometres: number | null;
            agreementVersion: string;
            agreementSnapshot: string | null;
            agreementAcceptedAt: Date | null;
        })[];
        earnings: {
            grossCollected: number;
            paidBookings: number;
            payoutStatus: string;
        };
        disputes: {
            id: string;
            reference: any;
            bookingId: any;
            bookingRef: any;
            vehicleTitle: any;
            category: any;
            description: any;
            amountClaimed: any;
            mediaId: any;
            status: any;
            adminResponse: any;
            history: {
                id: string;
                status: any;
                note: any;
                createdAt: Date;
            }[];
            createdAt: Date;
        }[];
    } | {
        role: string;
        profile: {
            id: string;
            email: string;
            phone: string | null;
            phoneVerifiedAt: Date | null;
            firstName: string;
            lastName: string;
            isVerified: boolean;
            dlValidUntil: Date | null;
            profile: {
                id: string;
                firstName: string;
                lastName: string;
                createdAt: Date;
                updatedAt: Date;
                city: string;
                state: string;
                postalCode: string | null;
                aadhaarNumberHash: string | null;
                aadhaarNumberMasked: string | null;
                panNumberHash: string | null;
                panNumberMasked: string | null;
                drivingLicenseHash: string | null;
                drivingLicenseMasked: string | null;
                dlExpiryDate: Date | null;
                profileImageUrl: string | null;
                selfieMediaId: string | null;
                faceMatchScore: number | null;
                faceMatchStatus: string | null;
                isKycVerified: boolean;
                userId: string;
            } | null;
        } | null;
        kyc: {
            verified: boolean;
            dlValidUntil: Date | null;
        };
        bookingCounts: {
            [k: string]: number;
        };
        upcoming: ({
            vehicle: {
                id: string;
                year: number;
                make: string;
                model: string;
                locationCity: string;
                registrationNumber: string | null;
            };
            payment: {
                status: string;
            } | null;
        } & {
            status: import("@prisma/client").$Enums.BookingStatus;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            bookingRef: string;
            customerId: string;
            vehicleId: string;
            driverId: string | null;
            pickupHubId: string | null;
            dropoffHubId: string | null;
            startDate: Date;
            endDate: Date;
            tenureHours: number;
            serviceType: string;
            baseFare: import("@prisma/client-runtime-utils").Decimal;
            securityDeposit: import("@prisma/client-runtime-utils").Decimal;
            insuranceFee: import("@prisma/client-runtime-utils").Decimal;
            discountAmount: import("@prisma/client-runtime-utils").Decimal;
            taxAmount: import("@prisma/client-runtime-utils").Decimal;
            platformFee: import("@prisma/client-runtime-utils").Decimal;
            hostRevenue: import("@prisma/client-runtime-utils").Decimal;
            totalAmount: import("@prisma/client-runtime-utils").Decimal;
            expiresAt: Date | null;
            requestKey: string | null;
            dailyRate: import("@prisma/client-runtime-utils").Decimal;
            rentalDays: number;
            includedKilometres: number | null;
            agreementVersion: string;
            agreementSnapshot: string | null;
            agreementAcceptedAt: Date | null;
        })[];
        recent: ({
            vehicle: {
                make: string;
                model: string;
                locationCity: string;
            };
            invoice: {
                number: string;
                status: string;
            } | null;
            payment: {
                status: string;
            } | null;
            settlement: {
                status: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                bookingId: string;
                note: string | null;
                depositHeld: import("@prisma/client-runtime-utils").Decimal;
                automaticCharges: import("@prisma/client-runtime-utils").Decimal;
                damageCharges: import("@prisma/client-runtime-utils").Decimal;
                fuelCharges: import("@prisma/client-runtime-utils").Decimal;
                tollCharges: import("@prisma/client-runtime-utils").Decimal;
                fineCharges: import("@prisma/client-runtime-utils").Decimal;
                cleaningCharges: import("@prisma/client-runtime-utils").Decimal;
                otherCharges: import("@prisma/client-runtime-utils").Decimal;
                totalDeduction: import("@prisma/client-runtime-utils").Decimal;
                refundAmount: import("@prisma/client-runtime-utils").Decimal;
                additionalAmountDue: import("@prisma/client-runtime-utils").Decimal;
                reviewedById: string | null;
            } | null;
        } & {
            status: import("@prisma/client").$Enums.BookingStatus;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            bookingRef: string;
            customerId: string;
            vehicleId: string;
            driverId: string | null;
            pickupHubId: string | null;
            dropoffHubId: string | null;
            startDate: Date;
            endDate: Date;
            tenureHours: number;
            serviceType: string;
            baseFare: import("@prisma/client-runtime-utils").Decimal;
            securityDeposit: import("@prisma/client-runtime-utils").Decimal;
            insuranceFee: import("@prisma/client-runtime-utils").Decimal;
            discountAmount: import("@prisma/client-runtime-utils").Decimal;
            taxAmount: import("@prisma/client-runtime-utils").Decimal;
            platformFee: import("@prisma/client-runtime-utils").Decimal;
            hostRevenue: import("@prisma/client-runtime-utils").Decimal;
            totalAmount: import("@prisma/client-runtime-utils").Decimal;
            expiresAt: Date | null;
            requestKey: string | null;
            dailyRate: import("@prisma/client-runtime-utils").Decimal;
            rentalDays: number;
            includedKilometres: number | null;
            agreementVersion: string;
            agreementSnapshot: string | null;
            agreementAcceptedAt: Date | null;
        })[];
        disputes: {
            id: string;
            reference: any;
            bookingId: any;
            bookingRef: any;
            vehicleTitle: any;
            category: any;
            description: any;
            amountClaimed: any;
            mediaId: any;
            status: any;
            adminResponse: any;
            history: {
                id: string;
                status: any;
                note: any;
                createdAt: Date;
            }[];
            createdAt: Date;
        }[];
    }>;
    updateProfile(req: any, body: any): Promise<{
        ok: boolean;
        firstName: string;
        lastName: string;
        phone: string | null;
    }>;
    changePassword(req: any, body: any): Promise<{
        ok: boolean;
    }>;
    listDisputes(req: any): Promise<{
        id: string;
        reference: any;
        bookingId: any;
        bookingRef: any;
        vehicleTitle: any;
        category: any;
        description: any;
        amountClaimed: any;
        mediaId: any;
        status: any;
        adminResponse: any;
        history: {
            id: string;
            status: any;
            note: any;
            createdAt: Date;
        }[];
        createdAt: Date;
    }[]>;
    createDispute(req: any, body: any): Promise<{
        createdAt: Date;
        reference: string;
        bookingId: string;
        bookingRef: string;
        vehicleTitle: string;
        category: string;
        description: string;
        amountClaimed: number;
        mediaId: string | null;
        status: string;
        id: string;
    }>;
    requestAccountDeletion(req: any, body: any): Promise<{
        ok: boolean;
    }>;
}
