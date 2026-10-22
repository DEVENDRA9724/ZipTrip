import { PrismaService } from '../prisma/prisma.service';
export declare class ReviewsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    listForVehicle(vehicleId: string): Promise<{
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
        count: number;
        average: number | null;
    }>;
    create(authorId: string, body: any): Promise<{
        id: string;
        createdAt: Date;
        vehicleId: string;
        authorId: string;
        rating: number;
        comment: string | null;
    }>;
    listForUser(userId: string): Promise<{
        ratings: ({
            author: {
                firstName: string;
                lastName: string;
                role: import("@prisma/client").$Enums.Role;
            };
        } & {
            id: string;
            createdAt: Date;
            targetId: string;
            authorId: string;
            rating: number;
            comment: string | null;
            bookingId: string;
            targetRole: string;
        })[];
        count: number;
        average: number | null;
    }>;
    listAuthored(userId: string): Promise<{
        vehicleReviews: ({
            vehicle: {
                id: string;
                year: number;
                make: string;
                model: string;
                registrationNumber: string | null;
            };
        } & {
            id: string;
            createdAt: Date;
            vehicleId: string;
            authorId: string;
            rating: number;
            comment: string | null;
        })[];
        partyRatings: ({
            booking: {
                bookingRef: string;
            };
            target: {
                firstName: string;
                lastName: string;
                role: import("@prisma/client").$Enums.Role;
            };
        } & {
            id: string;
            createdAt: Date;
            targetId: string;
            authorId: string;
            rating: number;
            comment: string | null;
            bookingId: string;
            targetRole: string;
        })[];
    }>;
    createParty(author: {
        id: string;
        role: string;
    }, body: any): Promise<{
        target: {
            firstName: string;
            lastName: string;
            role: import("@prisma/client").$Enums.Role;
        };
    } & {
        id: string;
        createdAt: Date;
        targetId: string;
        authorId: string;
        rating: number;
        comment: string | null;
        bookingId: string;
        targetRole: string;
    }>;
}
