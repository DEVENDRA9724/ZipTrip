import { OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
export declare const HOLD_EXPIRED = "HOLD_EXPIRED";
export declare class HoldExpiryService implements OnApplicationBootstrap, OnModuleDestroy {
    private readonly prisma;
    private readonly logger;
    private timer?;
    private running;
    constructor(prisma: PrismaService);
    onApplicationBootstrap(): void;
    onModuleDestroy(): void;
    expireHolds(now?: Date): Promise<{
        expired: number;
    }>;
}
