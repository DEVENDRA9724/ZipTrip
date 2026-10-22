"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentEvidenceService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const sandbox_service_1 = require("./sandbox.service");
const media_service_1 = require("../media/media.service");
let DocumentEvidenceService = class DocumentEvidenceService {
    prisma;
    sandbox;
    media;
    constructor(prisma, sandbox, media) {
        this.prisma = prisma;
        this.sandbox = sandbox;
        this.media = media;
    }
    async archive(userId, kind, evidence) {
        if (!this.media)
            throw new common_1.ServiceUnavailableException('Private document storage is not configured');
        const files = Array.isArray(evidence?.files) ? evidence.files.filter(file => typeof file?.url === 'string') : [];
        const preferred = kind === 'AADHAAR'
            ? files.find(file => /\.xml(?:$|\?)/i.test(file.url)) || files.find(file => /\.pdf(?:$|\?)/i.test(file.url)) || files[0]
            : files.find(file => /\.pdf(?:$|\?)/i.test(file.url)) || files.find(file => /\.xml(?:$|\?)/i.test(file.url)) || files[0];
        if (!preferred)
            throw new common_1.ServiceUnavailableException('The provider returned no original file to archive');
        let url;
        try {
            url = new URL(preferred.url);
        }
        catch {
            throw new common_1.ServiceUnavailableException('The provider returned an invalid original file URL');
        }
        if (url.protocol !== 'https:' || url.username || url.password)
            throw new common_1.ServiceUnavailableException('The provider returned an unsafe original file URL');
        let response;
        try {
            response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(20000) });
        }
        catch {
            throw new common_1.ServiceUnavailableException('The original provider file could not be downloaded for secure storage');
        }
        if (!response.ok)
            throw new common_1.ServiceUnavailableException('The original provider file could not be downloaded for secure storage');
        const contentLength = Number(response.headers.get('content-length') || 0);
        if (contentLength > 12 * 1024 * 1024)
            throw new common_1.ServiceUnavailableException('The original provider file exceeds the 12 MB storage limit');
        const buffer = Buffer.from(await response.arrayBuffer());
        const pathMime = url.pathname.toLowerCase().endsWith('.pdf') ? 'application/pdf' : url.pathname.toLowerCase().endsWith('.xml') ? 'application/xml' : '';
        const mimeType = (response.headers.get('content-type') || pathMime || 'application/octet-stream').split(';')[0].trim().toLowerCase();
        return this.media.storePrivateDocument(userId, kind, buffer, mimeType);
    }
    async available(doc) {
        try {
            return { ...await this.original(doc), documentId: doc.id };
        }
        catch (error) {
            if (!doc.id || !doc.providerSessionId || !/no original files|no longer has/i.test(error.message))
                throw error;
            const sessions = await this.prisma.kycSession.findMany({
                where: { userId: doc.userId, environment: this.sandbox.environment(), status: 'succeeded' },
                orderBy: { consentAt: 'desc' }, take: 3,
            });
            const candidates = await this.prisma.document.findMany({ where: {
                    userId: doc.userId, kind: doc.kind, source: doc.source, id: { not: doc.id },
                    status: { in: ['PENDING', 'APPROVED'] }, providerSessionId: { in: sessions.map(s => s.id) },
                } });
            for (const session of sessions) {
                const candidate = candidates.find(d => d.providerSessionId === session.id);
                if (!candidate)
                    continue;
                try {
                    return { ...await this.original(candidate), documentId: candidate.id,
                        notice: 'The selected session no longer provides this file. Showing your available ' + doc.kind + ' record from another completed session. Review decisions apply to this displayed record.' };
                }
                catch (next) {
                    if (!/no original files|no longer has/i.test(next.message))
                        throw next;
                }
            }
            throw new common_1.ServiceUnavailableException('This DigiLocker session has expired and no original file is available from Sandbox. Keep this review pending and ask the customer to Start a new DigiLocker verification, share both documents, and click Sync & Refresh. Newly synced XML/PDF originals are archived securely for future review and download.');
        }
    }
    async original(doc) {
        const unavailable = (reason) => new common_1.ServiceUnavailableException('Original document unavailable. ' + reason);
        if (doc.mediaId) {
            const media = await this.prisma.media.findFirst({ where: { id: doc.mediaId, ownerId: doc.userId, kind: doc.kind } });
            if (!media)
                throw unavailable('The securely archived document could not be found. Complete verification again.');
            const providerFile = doc.source.startsWith('DIGILOCKER_');
            return {
                source: providerFile ? 'DIGILOCKER' : 'UPLOAD',
                ...(providerFile ? { environment: 'archived' } : {}),
                files: [{ url: '/api/media/' + media.id, metadata: { description: doc.kind + (providerFile ? ' — original provider file' : ' — uploaded image'), ContentType: media.mimeType, ...(providerFile ? { isArchived: true } : {}) } }],
            };
        }
        if (doc.providerSessionId || doc.source.startsWith('DIGILOCKER_')) {
            if (!doc.providerSessionId)
                throw unavailable('No DigiLocker session is linked to this record. Complete DigiLocker verification again.');
            const session = await this.prisma.kycSession.findUnique({ where: { id: doc.providerSessionId } });
            if (!session || session.userId !== doc.userId)
                throw unavailable('The linked DigiLocker session could not be found. Complete verification again.');
            if (session.environment !== this.sandbox.environment())
                throw unavailable('This record belongs to a different Sandbox environment. Ask the administrator to check the configuration.');
            const kind = { AADHAAR: 'aadhaar', DL: 'driving_license' }[doc.kind];
            if (!kind)
                throw unavailable('This document type cannot be retrieved through DigiLocker.');
            let result;
            try {
                result = await this.sandbox.call('/kyc/digilocker/sessions/' + encodeURIComponent(session.providerId) + '/documents/' + kind);
            }
            catch (error) {
                error = { message: error?.providerMessage ?? error?.message ?? '' };
                if (/insufficient credits/i.test(error.message))
                    throw unavailable('Sandbox reports insufficient credits. Ask the administrator to check the live API wallet.');
                if (/data not found|expired|no longer available/i.test(error.message))
                    throw unavailable('Sandbox no longer has the original file for this expired session. Ask the customer to start a new DigiLocker verification and sync it again.');
                throw unavailable('DigiLocker/Sandbox could not return the file. Retry, or complete verification again if access has expired.');
            }
            const files = Array.isArray(result?.files) ? result.files.filter((file) => {
                if (typeof file?.url !== 'string')
                    return false;
                try {
                    const url = new URL(file.url);
                    return url.protocol === 'https:' && !url.username && !url.password;
                }
                catch {
                    return false;
                }
            }) : [];
            if (!files.length)
                throw unavailable('The provider returned no original files. Retry or complete DigiLocker verification again.');
            return { source: 'DIGILOCKER', environment: session.environment, files };
        }
        throw unavailable('No provider file or uploaded image is linked to this record. Complete verification again or upload the document.');
    }
};
exports.DocumentEvidenceService = DocumentEvidenceService;
exports.DocumentEvidenceService = DocumentEvidenceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, sandbox_service_1.SandboxService, media_service_1.MediaService])
], DocumentEvidenceService);
//# sourceMappingURL=document-evidence.service.js.map