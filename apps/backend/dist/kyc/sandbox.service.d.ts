import { BadGatewayException } from '@nestjs/common';
export declare class ProviderRequestError extends BadGatewayException {
    readonly providerMessage: string;
    constructor(providerMessage: string);
}
export declare class SandboxService {
    private readonly logger;
    private token?;
    private expires;
    environment(): "test" | "live";
    configured(): boolean;
    private request;
    call(path: string, method?: string, body?: any): Promise<any>;
}
