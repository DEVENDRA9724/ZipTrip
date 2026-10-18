import { PrismaService } from '../prisma/prisma.service';
export declare class VehiclesService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(query: any): import("@prisma/client").Prisma.PrismaPromise<({
        media: {
            id: string;
            kind: string;
        }[];
        reviews: {
            rating: number;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        year: number;
        make: string;
        model: string;
        hostId: string;
        modelSpecId: string | null;
        currentHubId: string | null;
        category: string;
        transmission: string;
        fuelType: string;
        seats: number;
        pricePerDay: import("@prisma/client-runtime-utils").Decimal;
        extraKmCharge: import("@prisma/client-runtime-utils").Decimal;
        includedKilometresPerDay: number;
        securityDeposit: import("@prisma/client-runtime-utils").Decimal;
        status: import("@prisma/client").$Enums.VehicleStatus;
        serviceType: string;
        locationCity: string;
        pickupAddress: string | null;
        dropAddress: string | null;
        latitude: number | null;
        longitude: number | null;
        images: string;
        features: string | null;
        vinNumber: string | null;
        gpsDeviceImei: string | null;
        fuelLevelPercent: number;
        registrationNumber: string | null;
        odometer: number;
        reviewNote: string | null;
    })[]>;
    findOne(id: string): Promise<{
        media: {
            id: string;
            kind: string;
        }[];
        reviews: ({
            author: {
                firstName: string;
                lastName: string;
            };
        } & {
            id: string;
            createdAt: Date;
            vehicleId: string;
            authorId: string;
            rating: number;
            comment: string | null;
        })[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        year: number;
        make: string;
        model: string;
        hostId: string;
        modelSpecId: string | null;
        currentHubId: string | null;
        category: string;
        transmission: string;
        fuelType: string;
        seats: number;
        pricePerDay: import("@prisma/client-runtime-utils").Decimal;
        extraKmCharge: import("@prisma/client-runtime-utils").Decimal;
        includedKilometresPerDay: number;
        securityDeposit: import("@prisma/client-runtime-utils").Decimal;
        status: import("@prisma/client").$Enums.VehicleStatus;
        serviceType: string;
        locationCity: string;
        pickupAddress: string | null;
        dropAddress: string | null;
        latitude: number | null;
        longitude: number | null;
        images: string;
        features: string | null;
        vinNumber: string | null;
        gpsDeviceImei: string | null;
        fuelLevelPercent: number;
        registrationNumber: string | null;
        odometer: number;
        reviewNote: string | null;
    }>;
    quote(id: string, query: any): Promise<{
        currency: string;
        dailyRate: number;
        rentalDays: number;
        includedKilometres: number;
        rentalAmount: number;
        securityDeposit: number;
        totalAmount: number;
        excessKmRate: number;
        pricingBasis: string;
        vehicleId: string;
        startDate: string;
        endDate: string;
    }>;
    schedule(hostId: string, id: string): Promise<{
        blocks: {
            id: string;
            createdAt: Date;
            vehicleId: string;
            startDate: Date;
            endDate: Date;
            reason: string;
            releasedAt: Date | null;
        }[];
        bookings: {
            id: string;
            status: import("@prisma/client").$Enums.BookingStatus;
            bookingRef: string;
            startDate: Date;
            endDate: Date;
        }[];
    }>;
    hostAgreement(user: any, id: string): Promise<{
        agreementVersion: string;
        generatedAt: string;
        business: {
            name: string;
            address: string;
            email: string;
            phone: string;
        };
        host: {
            id: string;
            email: string;
            phone: string | null;
            firstName: string;
            lastName: string;
        };
        vehicle: {
            id: string;
            make: string;
            model: string;
            year: number;
            registrationNumber: string | null;
            city: string;
            status: import("@prisma/client").$Enums.VehicleStatus;
            dailyRate: number;
        };
        commercialTerms: {
            platformRole: string;
            hostPayout: string;
            securityDeposit: number;
            includedKilometresPer24Hours: number;
            excessKmRate: number;
        };
        acknowledgement: {
            acceptedAt: Date;
            version: string;
        } | null;
        terms: string[];
    }>;
    acknowledgeHostAgreement(user: any, id: string): Promise<{
        acceptedAt: Date;
        version: string;
    }>;
    block(hostId: string, id: string, body: any): Promise<{
        id: string;
        createdAt: Date;
        vehicleId: string;
        startDate: Date;
        endDate: Date;
        reason: string;
        releasedAt: Date | null;
    }>;
    releaseBlock(hostId: string, vehicleId: string, blockId: string): Promise<{
        released: boolean;
    }>;
    private managementScope;
    mine(hostId: string): import("@prisma/client").Prisma.PrismaPromise<({
        media: {
            id: string;
            kind: string;
        }[];
        documents: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            reviewNote: string | null;
            vehicleId: string | null;
            kind: string;
            userId: string;
            documentNumberMasked: string | null;
            documentFrontUrl: string | null;
            documentBackUrl: string | null;
            mediaId: string | null;
            source: string;
            providerSessionId: string | null;
            validUntil: Date | null;
            verifiedById: string | null;
            verifiedAt: Date | null;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        year: number;
        make: string;
        model: string;
        hostId: string;
        modelSpecId: string | null;
        currentHubId: string | null;
        category: string;
        transmission: string;
        fuelType: string;
        seats: number;
        pricePerDay: import("@prisma/client-runtime-utils").Decimal;
        extraKmCharge: import("@prisma/client-runtime-utils").Decimal;
        includedKilometresPerDay: number;
        securityDeposit: import("@prisma/client-runtime-utils").Decimal;
        status: import("@prisma/client").$Enums.VehicleStatus;
        serviceType: string;
        locationCity: string;
        pickupAddress: string | null;
        dropAddress: string | null;
        latitude: number | null;
        longitude: number | null;
        images: string;
        features: string | null;
        vinNumber: string | null;
        gpsDeviceImei: string | null;
        fuelLevelPercent: number;
        registrationNumber: string | null;
        odometer: number;
        reviewNote: string | null;
    })[]>;
    create(hostId: string, data: any): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        year: number;
        make: string;
        model: string;
        hostId: string;
        modelSpecId: string | null;
        currentHubId: string | null;
        category: string;
        transmission: string;
        fuelType: string;
        seats: number;
        pricePerDay: import("@prisma/client-runtime-utils").Decimal;
        extraKmCharge: import("@prisma/client-runtime-utils").Decimal;
        includedKilometresPerDay: number;
        securityDeposit: import("@prisma/client-runtime-utils").Decimal;
        status: import("@prisma/client").$Enums.VehicleStatus;
        serviceType: string;
        locationCity: string;
        pickupAddress: string | null;
        dropAddress: string | null;
        latitude: number | null;
        longitude: number | null;
        images: string;
        features: string | null;
        vinNumber: string | null;
        gpsDeviceImei: string | null;
        fuelLevelPercent: number;
        registrationNumber: string | null;
        odometer: number;
        reviewNote: string | null;
    }>;
}
