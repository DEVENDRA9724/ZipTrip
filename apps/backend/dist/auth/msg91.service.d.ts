export declare class Msg91Service {
    readonly provider: string;
    isEnabled(): boolean;
    normalizePhone(input: unknown): string;
    providerPhone(phone: string): string;
    private config;
    private parse;
    private successful;
    private providerError;
    sendOtp(phone: string): Promise<{
        requestId: any;
    }>;
    verifyOtp(phone: string, otp: string): Promise<{
        verified: boolean;
    }>;
}
