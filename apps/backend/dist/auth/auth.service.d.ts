import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Msg91Service } from './msg91.service';
export declare class AuthService {
    private prisma;
    private jwtService;
    private msg91;
    constructor(prisma: PrismaService, jwtService: JwtService, msg91: Msg91Service);
    private sha256;
    private isMsg91;
    private exposeDevOtp;
    private findByPhone;
    private sanitizeUser;
    register(data: any): Promise<{
        user: any;
        token: string;
        devOtp: string | undefined;
    }>;
    login(data: any): Promise<{
        user: any;
        token: string;
    }>;
    requestLoginOtp(phoneInput: string): Promise<{
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
    loginWithOtp(phoneInput: string, otpInput: string): Promise<{
        user: any;
        token: string;
    }>;
    private maskPhone;
    sendOtp(userId: string, phoneInput?: string): Promise<{
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
    verifyOtp(userId: string, otpInput: string): Promise<{
        verified: boolean;
        user: any;
    }>;
    validateUser(id: string): Promise<any>;
}
