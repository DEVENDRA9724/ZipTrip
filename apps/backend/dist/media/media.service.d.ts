import { PrismaService } from '../prisma/prisma.service';
export declare class MediaService {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    private get storage();
    private key;
    upload(userId: string, kindInput: string, file: any): Promise<{
        id: string;
        kind: string;
        url: string;
    }>;
    storePrivateDocument(ownerId: string, kindInput: string, buffer: Buffer, mimeType: string): Promise<string>;
    read(id: string, user?: {
        id: string;
        role: string;
    }): Promise<{
        buffer: Buffer<ArrayBufferLike>;
        mimeType: string;
        kind: string;
    }>;
}
