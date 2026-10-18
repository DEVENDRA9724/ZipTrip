import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
export declare class AuthService {
    private prisma;
    private jwtService;
    constructor(prisma: PrismaService, jwtService: JwtService);
    private sha256;
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
    sendOtp(userId: string, phoneInput?: string): Promise<{
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
