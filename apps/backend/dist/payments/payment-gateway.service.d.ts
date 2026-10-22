import { PrismaService } from '../prisma/prisma.service';
export declare class PaymentGatewayService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    createRazorpayOrder(customerId: string, bookingId: string): Promise<{
        provider: string;
        keyId: string;
        orderId: string;
        bookingId: string;
        bookingRef: string;
        amount: number;
        currency: string;
        customer: {
            name: string;
            email: string;
            phone: string | null;
        };
    }>;
}
