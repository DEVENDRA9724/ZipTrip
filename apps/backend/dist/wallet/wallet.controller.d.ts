import { WalletService } from './wallet.service';
export declare class WalletController {
    private readonly walletService;
    constructor(walletService: WalletService);
    getBalance(req: any): Promise<{
        id: string;
        updatedAt: Date;
        balance: import("@prisma/client-runtime-utils").Decimal;
        userId: string;
    }>;
    deposit(req: any, amount: number): Promise<void>;
}
