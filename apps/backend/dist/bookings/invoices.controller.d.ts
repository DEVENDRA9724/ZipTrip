import { PrismaService } from '../prisma/prisma.service';
export declare class InvoicesController {
    private prisma;
    constructor(prisma: PrismaService);
    get(req: any, id: string): Promise<{
        bookingRef: string;
        details: any;
        number: string;
        id: string;
        createdAt: Date;
        status: string;
        bookingId: string;
        amount: import("@prisma/client-runtime-utils").Decimal;
        currency: string;
    }>;
}
