import { PrismaService } from '../prisma/prisma.service';
import { SandboxService } from './sandbox.service';
import { MediaService } from '../media/media.service';
type EvidenceDocument = {
    id?: string;
    userId: string;
    kind: string;
    source: string;
    mediaId: string | null;
    providerSessionId: string | null;
};
export declare class DocumentEvidenceService {
    private prisma;
    private sandbox;
    private media?;
    constructor(prisma: PrismaService, sandbox: SandboxService, media?: MediaService | undefined);
    archive(userId: string, kind: string, evidence: {
        files?: Array<{
            url: string;
            metadata?: any;
        }>;
    }): Promise<string>;
    available(doc: EvidenceDocument): Promise<{
        documentId: string | undefined;
        files: {
            url: string;
            metadata: {
                isArchived?: boolean | undefined;
                description: string;
                ContentType: string;
            };
        }[];
        environment?: string | undefined;
        source: string;
    } | {
        documentId: string | undefined;
        source: string;
        environment: string;
        files: any;
    } | {
        documentId: string;
        notice: string;
        files: {
            url: string;
            metadata: {
                isArchived?: boolean | undefined;
                description: string;
                ContentType: string;
            };
        }[];
        environment?: string | undefined;
        source: string;
    } | {
        documentId: string;
        notice: string;
        source: string;
        environment: string;
        files: any;
    }>;
    original(doc: EvidenceDocument): Promise<{
        files: {
            url: string;
            metadata: {
                isArchived?: boolean | undefined;
                description: string;
                ContentType: string;
            };
        }[];
        environment?: string | undefined;
        source: string;
    } | {
        source: string;
        environment: string;
        files: any;
    }>;
}
export {};
