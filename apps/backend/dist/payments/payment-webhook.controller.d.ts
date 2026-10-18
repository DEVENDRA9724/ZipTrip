import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
export declare class PaymentWebhookController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    webhook(req: Request, headers: Record<string, string | string[] | undefined>): Promise<{
        ok: boolean;
        idempotent: boolean;
        bookingId: string;
        status: string;
    }>;
}
