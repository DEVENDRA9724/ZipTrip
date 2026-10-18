import { PaymentGatewayService } from './payment-gateway.service';
export declare class PaymentGatewayController {
    private readonly payments;
    constructor(payments: PaymentGatewayService);
    createCheckout(req: any, id: string): Promise<{
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
