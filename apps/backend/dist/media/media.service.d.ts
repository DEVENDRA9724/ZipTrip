import { PrismaService } from '../prisma/prisma.service';
export declare class MediaService {
    private prisma;
    private s3?;
    constructor(prisma: PrismaService);
    private directory;
    private bucket;
    private prefix;
    private objectKey;
    private objectStorageEnabled;
    private client;
    private writeStorage;
    private removeStorage;
    private readStorage;
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
        buffer: Buffer<ArrayBuffer>;
        mimeType: string;
    }>;
}
