import type { Response } from 'express';
import { AuthService } from './auth.service';
export declare class AuthController {
    private readonly auth;
    constructor(auth: AuthService);
    private session;
    register(body: any, res: Response): Promise<{
        user: any;
        token: any;
        devOtp: any;
    }>;
    login(body: any, res: Response): Promise<{
        user: any;
        token: any;
        devOtp: any;
    }>;
    requestLoginOtp(body: any): Promise<{
        sent: boolean;
        maskedPhone: string;
        expiresInSeconds: number;
        devOtp: string | undefined;
    } | {
        sent: boolean;
        maskedPhone: string;
        expiresInSeconds: number;
        devOtp?: undefined;
    }>;
    verifyLoginOtp(body: any, res: Response): Promise<{
        user: any;
        token: any;
        devOtp: any;
    }>;
    logout(res: Response): {
        message: string;
    };
    profile(req: any): Promise<any>;
    sendOtp(req: any, body: any): Promise<{
        sent: boolean;
        maskedPhone: string;
        expiresInSeconds: number;
        devOtp?: undefined;
    } | {
        sent: boolean;
        maskedPhone: string;
        expiresInSeconds: number;
        devOtp: string | undefined;
    }>;
    verifyOtp(req: any, body: any): Promise<{
        verified: boolean;
        user: any;
    }>;
}
