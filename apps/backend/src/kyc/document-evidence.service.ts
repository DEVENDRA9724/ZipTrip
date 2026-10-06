import { Injectable, ServiceUnavailableException } from '@nestjs/common';
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

@Injectable()
export class DocumentEvidenceService {
  constructor(private prisma: PrismaService, private sandbox: SandboxService, private media?: MediaService) {}

  /**
   * Preserve the provider's original bytes while the signed URL is still
   * usable. The file is encrypted by MediaService and is never converted to
   * a locally generated certificate or preview.
   */
  async archive(userId: string, kind: string, evidence: { files?: Array<{ url: string; metadata?: any }> }) {
    if (!this.media) throw new ServiceUnavailableException('Private document storage is not configured');
    const files = Array.isArray(evidence?.files) ? evidence.files.filter(file => typeof file?.url === 'string') : [];
    const preferred = kind === 'AADHAAR'
      ? files.find(file => /\.xml(?:$|\?)/i.test(file.url)) || files.find(file => /\.pdf(?:$|\?)/i.test(file.url)) || files[0]
      : files.find(file => /\.pdf(?:$|\?)/i.test(file.url)) || files.find(file => /\.xml(?:$|\?)/i.test(file.url)) || files[0];
    if (!preferred) throw new ServiceUnavailableException('The provider returned no original file to archive');
    let url: URL;
    try { url = new URL(preferred.url); } catch { throw new ServiceUnavailableException('The provider returned an invalid original file URL'); }
    if (url.protocol !== 'https:' || url.username || url.password) throw new ServiceUnavailableException('The provider returned an unsafe original file URL');
    let response: Response;
    try {
      response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(20000) });
    } catch { throw new ServiceUnavailableException('The original provider file could not be downloaded for secure storage'); }
    if (!response.ok) throw new ServiceUnavailableException('The original provider file could not be downloaded for secure storage');
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > 12 * 1024 * 1024) throw new ServiceUnavailableException('The original provider file exceeds the 12 MB storage limit');
    const buffer = Buffer.from(await response.arrayBuffer());
    const pathMime = url.pathname.toLowerCase().endsWith('.pdf') ? 'application/pdf' : url.pathname.toLowerCase().endsWith('.xml') ? 'application/xml' : '';
    const mimeType = (response.headers.get('content-type') || pathMime || 'application/octet-stream').split(';')[0].trim().toLowerCase();
    return this.media.storePrivateDocument(userId, kind, buffer, mimeType);
  }

  // Resolve another record explicitly, so its evidence is never used to approve the old one.
  async available(doc: EvidenceDocument) {
    try { return { ...await this.original(doc), documentId: doc.id }; }
    catch (error) {
      if (!doc.id || !doc.providerSessionId || !/no original files|no longer has/i.test(error.message)) throw error;
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
        if (!candidate) continue;
        try {
          return { ...await this.original(candidate), documentId: candidate.id,
            notice: 'The selected session no longer provides this file. Showing your available ' + doc.kind + ' record from another completed session. Review decisions apply to this displayed record.' };
        } catch (next) {
          if (!/no original files|no longer has/i.test(next.message)) throw next;
        }
      }
      throw new ServiceUnavailableException('This DigiLocker session has expired and no original file is available from Sandbox. Keep this review pending and ask the customer to Start a new DigiLocker verification, share both documents, and click Sync & Refresh. Newly synced XML/PDF originals are archived securely for future review and download.');
    }
  }

  async original(doc: EvidenceDocument) {
    const unavailable = (reason: string) => new ServiceUnavailableException(
      'Original document unavailable. ' + reason,
    );

    if (doc.mediaId) {
      const media = await this.prisma.media.findFirst({ where: { id: doc.mediaId, ownerId: doc.userId, kind: doc.kind } });
      if (!media) throw unavailable('The securely archived document could not be found. Complete verification again.');
      const providerFile = doc.source.startsWith('DIGILOCKER_');
      return {
        source: providerFile ? 'DIGILOCKER' : 'UPLOAD',
        ...(providerFile ? { environment: 'archived' } : {}),
        files: [{ url: '/api/media/' + media.id, metadata: { description: doc.kind + (providerFile ? ' — original provider file' : ' — uploaded image'), ContentType: media.mimeType, ...(providerFile ? { isArchived: true } : {}) } }],
      };
    }

    // A provider record must always resolve to the provider's file, never a local reconstruction.
    if (doc.providerSessionId || doc.source.startsWith('DIGILOCKER_')) {
      if (!doc.providerSessionId) throw unavailable('No DigiLocker session is linked to this record. Complete DigiLocker verification again.');
      const session = await this.prisma.kycSession.findUnique({ where: { id: doc.providerSessionId } });
      if (!session || session.userId !== doc.userId) throw unavailable('The linked DigiLocker session could not be found. Complete verification again.');
      if (session.environment !== this.sandbox.environment()) throw unavailable('This record belongs to a different Sandbox environment. Ask the administrator to check the configuration.');
      const kind = { AADHAAR: 'aadhaar', DL: 'driving_license' }[doc.kind];
      if (!kind) throw unavailable('This document type cannot be retrieved through DigiLocker.');

      let result: any;
      try {
        result = await this.sandbox.call('/kyc/digilocker/sessions/' + encodeURIComponent(session.providerId) + '/documents/' + kind);
      } catch (error) {
        if (/insufficient credits/i.test(error.message)) throw unavailable('Sandbox reports insufficient credits. Ask the administrator to check the live API wallet.');
        if (/data not found|expired|no longer available/i.test(error.message)) throw unavailable('Sandbox no longer has the original file for this expired session. Ask the customer to start a new DigiLocker verification and sync it again.');
        throw unavailable('DigiLocker/Sandbox could not return the file. Retry, or complete verification again if access has expired.');
      }
      const files = Array.isArray(result?.files) ? result.files.filter((file: any) => {
        if (typeof file?.url !== 'string') return false;
        try {
          const url = new URL(file.url);
          return url.protocol === 'https:' && !url.username && !url.password;
        } catch { return false; }
      }) : [];
      if (!files.length) throw unavailable('The provider returned no original files. Retry or complete DigiLocker verification again.');

      // Keep signed URLs exactly as supplied, including their query strings. Do not fetch,
      // convert, recreate, or persist the file or its short-lived download URL here.
      return { source: 'DIGILOCKER', environment: session.environment, files };
    }

    throw unavailable('No provider file or uploaded image is linked to this record. Complete verification again or upload the document.');
  }
}
