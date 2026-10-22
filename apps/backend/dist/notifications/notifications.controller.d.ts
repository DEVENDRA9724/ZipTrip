import { NotificationsService } from './notifications.service';
export declare class NotificationsController {
    private readonly notifications;
    constructor(notifications: NotificationsService);
    list(req: any): import("@prisma/client").Prisma.PrismaPromise<{
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
    readAll(req: any): Promise<{
        updated: number;
    }>;
    read(req: any, id: string): Promise<{
        id: string;
        readAt: Date;
    }>;
}
