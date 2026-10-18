export declare function renderDocumentCertificate(doc: {
    id: string;
    kind: string;
    status: string;
    source?: string;
    validUntil?: Date | null;
    createdAt: Date;
    mediaId?: string | null;
    user?: {
        firstName?: string;
        lastName?: string;
        email?: string;
    } | null;
    vehicle?: {
        make?: string;
        model?: string;
        registrationNumber?: string | null;
    } | null;
}): string;
