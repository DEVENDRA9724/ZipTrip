import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from './media.service';
import type { Response } from 'express';
export declare class MediaController {
    private media;
    private jwt;
    private prisma;
    constructor(media: MediaService, jwt: JwtService, prisma: PrismaService);
    upload(req: any, kind: string, file: any): Promise<{
        id: string;
        kind: string;
        url: string;
    }>;
    read(id: string, req: any, res: Response, download?: string): Promise<void>;
}
