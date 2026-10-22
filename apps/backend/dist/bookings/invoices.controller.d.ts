import { PrismaService } from '../prisma/prisma.service';
export declare class InvoicesController {
    private prisma;
    constructor(prisma: PrismaService);
    get(req: any, id: string): Promise<{
        bookingRef: string;
        details: any;
        number: string;
        status: string;
        id: string;
        createdAt: Date;
        bookingId: string;
        amount: import("@prisma/client-runtime-utils").Decimal;
        currency: string;
    }>;
}
