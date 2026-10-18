export declare class SandboxService {
    private readonly logger;
    private token?;
    private expires;
    environment(): "live" | "test";
    configured(): boolean;
    private request;
    call(path: string, method?: string, body?: any): Promise<any>;
}
