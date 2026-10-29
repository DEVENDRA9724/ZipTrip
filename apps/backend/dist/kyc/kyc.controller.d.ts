import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { SandboxService } from './sandbox.service';
import { DocumentEvidenceService } from './document-evidence.service';
export declare class KycController {
    private prisma;
    private sandbox;
    private documents;
    constructor(prisma: PrismaService, sandbox: SandboxService, documents: DocumentEvidenceService);
    private sha256;
    status(req: any): Promise<{
        configured: boolean;
        environment: string;
        documents: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            mediaId: string | null;
            source: string;
            vehicleId: string | null;
            status: string;
            reviewNote: string | null;
            kind: string;
            userId: string;
            documentNumberMasked: string | null;
            documentFrontUrl: string | null;
            documentBackUrl: string | null;
            providerSessionId: string | null;
            validUntil: Date | null;
            verifiedById: string | null;
            verifiedAt: Date | null;
        }[];
        sessions: {
            id: string;
            status: string;
            expiresAt: Date;
            environment: string;
            consentAt: Date;
        }[];
        profile: {
            id: string;
            firstName: string;
            lastName: string;
            createdAt: Date;
            updatedAt: Date;
            city: string;
            state: string;
            postalCode: string | null;
            aadhaarNumberHash: string | null;
            aadhaarNumberMasked: string | null;
            panNumberHash: string | null;
            panNumberMasked: string | null;
            drivingLicenseHash: string | null;
            drivingLicenseMasked: string | null;
            dlExpiryDate: Date | null;
            profileImageUrl: string | null;
            selfieMediaId: string | null;
            faceMatchScore: number | null;
            faceMatchStatus: string | null;
            isKycVerified: boolean;
            userId: string;
        } | null;
        user: {
            id: string;
            phone: string | null;
            phoneVerifiedAt: Date | null;
            isVerified: boolean;
            dlValidUntil: Date | null;
        } | null;
    }>;
    document(req: any, body: any): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        mediaId: string | null;
        source: string;
        vehicleId: string | null;
        status: string;
        reviewNote: string | null;
        kind: string;
        userId: string;
        documentNumberMasked: string | null;
        documentFrontUrl: string | null;
        documentBackUrl: string | null;
        providerSessionId: string | null;
        validUntil: Date | null;
        verifiedById: string | null;
        verifiedAt: Date | null;
    }>;
    verifyIdentityAndFaceMatch(req: any, body: any): Promise<{
        autoVerified: boolean;
        faceMatchScore: null;
        aadhaarMasked: string;
        dlMasked: string;
        dlExpiryDate: Date;
        status: string;
        documents: string[];
        profile: {
            id: string;
            firstName: string;
            lastName: string;
            createdAt: Date;
            updatedAt: Date;
            city: string;
            state: string;
            postalCode: string | null;
            aadhaarNumberHash: string | null;
            aadhaarNumberMasked: string | null;
            panNumberHash: string | null;
            panNumberMasked: string | null;
            drivingLicenseHash: string | null;
            drivingLicenseMasked: string | null;
            dlExpiryDate: Date | null;
            profileImageUrl: string | null;
            selfieMediaId: string | null;
            faceMatchScore: number | null;
            faceMatchStatus: string | null;
            isKycVerified: boolean;
            userId: string;
        };
    }>;
    start(req: any, body: any): Promise<{
        id: string;
        authorizationUrl: string;
    }>;
    sync(req: any, id: string): Promise<{
        syncResults: {
            kind: string;
            state: string;
            message?: string;
        }[];
        syncMessage: string;
        configured: boolean;
        environment: string;
        documents: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            mediaId: string | null;
            source: string;
            vehicleId: string | null;
            status: string;
            reviewNote: string | null;
            kind: string;
            userId: string;
            documentNumberMasked: string | null;
            documentFrontUrl: string | null;
            documentBackUrl: string | null;
            providerSessionId: string | null;
            validUntil: Date | null;
            verifiedById: string | null;
            verifiedAt: Date | null;
        }[];
        sessions: {
            id: string;
            status: string;
            expiresAt: Date;
            environment: string;
            consentAt: Date;
        }[];
        profile: {
            id: string;
            firstName: string;
            lastName: string;
            createdAt: Date;
            updatedAt: Date;
            city: string;
            state: string;
            postalCode: string | null;
            aadhaarNumberHash: string | null;
            aadhaarNumberMasked: string | null;
            panNumberHash: string | null;
            panNumberMasked: string | null;
            drivingLicenseHash: string | null;
            drivingLicenseMasked: string | null;
            dlExpiryDate: Date | null;
            profileImageUrl: string | null;
            selfieMediaId: string | null;
            faceMatchScore: number | null;
            faceMatchStatus: string | null;
            isKycVerified: boolean;
            userId: string;
        } | null;
        user: {
            id: string;
            phone: string | null;
            phoneVerifiedAt: Date | null;
            isVerified: boolean;
            dlValidUntil: Date | null;
        } | null;
    } | {
        syncResults: {
            kind: string;
            state: string;
            message?: string;
        }[];
        configured: boolean;
        environment: string;
        documents: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            mediaId: string | null;
            source: string;
            vehicleId: string | null;
            status: string;
            reviewNote: string | null;
            kind: string;
            userId: string;
            documentNumberMasked: string | null;
            documentFrontUrl: string | null;
            documentBackUrl: string | null;
            providerSessionId: string | null;
            validUntil: Date | null;
            verifiedById: string | null;
            verifiedAt: Date | null;
        }[];
        sessions: {
            id: string;
            status: string;
            expiresAt: Date;
            environment: string;
            consentAt: Date;
        }[];
        profile: {
            id: string;
            firstName: string;
            lastName: string;
            createdAt: Date;
            updatedAt: Date;
            city: string;
            state: string;
            postalCode: string | null;
            aadhaarNumberHash: string | null;
            aadhaarNumberMasked: string | null;
            panNumberHash: string | null;
            panNumberMasked: string | null;
            drivingLicenseHash: string | null;
            drivingLicenseMasked: string | null;
            dlExpiryDate: Date | null;
            profileImageUrl: string | null;
            selfieMediaId: string | null;
            faceMatchScore: number | null;
            faceMatchStatus: string | null;
            isKycVerified: boolean;
            userId: string;
        } | null;
        user: {
            id: string;
            phone: string | null;
            phoneVerifiedAt: Date | null;
            isVerified: boolean;
            dlValidUntil: Date | null;
        } | null;
    }>;
    certificate(req: any, id: string, res: Response): Promise<void>;
    evidence(req: any, id: string): Promise<{
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
}
