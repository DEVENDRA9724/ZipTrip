import { PrismaService } from '../prisma/prisma.service';
export declare class NotificationsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(userId: string): import("@prisma/client").Prisma.PrismaPromise<{
        message: string;
        type: string;
        id: string;
        createdAt: Date;
        userId: string;
        title: string;
        bookingId: string | null;
        metadata: string | null;
        readAt: Date | null;
    }[]>;
    markRead(userId: string, id: string): Promise<{
        id: string;
        readAt: Date;
    }>;
    markAllRead(userId: string): Promise<{
        updated: number;
    }>;
    create(userId: string, data: {
        type: string;
        title: string;
        message: string;
        bookingId?: string;
        metadata?: any;
    }): Promise<{
        message: string;
        type: string;
        id: string;
        createdAt: Date;
        userId: string;
        title: string;
        bookingId: string | null;
        metadata: string | null;
        readAt: Date | null;
    }>;
}
