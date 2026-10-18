import { WalletService } from './wallet.service';
export declare class WalletController {
    private readonly walletService;
    constructor(walletService: WalletService);
    getBalance(req: any): Promise<{
        id: string;
        updatedAt: Date;
        userId: string;
        balance: import("@prisma/client-runtime-utils").Decimal;
    }>;
    deposit(req: any, amount: number): Promise<void>;
}
