import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
export declare class OperationsService implements OnModuleInit, OnModuleDestroy {
    private readonly prisma;
    private readonly notifications;
    private readonly logger;
    private timer?;
    constructor(prisma: PrismaService, notifications: NotificationsService);
    onModuleInit(): void;
    onModuleDestroy(): void;
    reconcile(now?: Date): Promise<{
        checkedAt: string;
        holdsReleased: number;
        vehiclesSuspended: number;
    }>;
}
