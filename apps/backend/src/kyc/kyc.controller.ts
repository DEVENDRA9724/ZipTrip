import { Controller, Get, Post, Body, Param, Request, Res, UseGuards, BadRequestException, NotFoundException, BadGatewayException } from '@nestjs/common';
import type { Response } from 'express';
import { createHash } from 'node:crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { SandboxService } from './sandbox.service';
import { choice, DOCUMENT_KINDS, text } from '../common/validation';
import { DocumentEvidenceService } from './document-evidence.service';

@Controller('kyc')
@UseGuards(JwtAuthGuard)
export class KycController {
  constructor(
    private prisma: PrismaService,
    private sandbox: SandboxService,
    private documents: DocumentEvidenceService,
  ) {}

  private sha256(val: string) {
    return createHash('sha256').update(String(val)).digest('hex');
  }

  @Get()
  async status(@Request() req: any) {
    const [documents, sessions, profile, user] = await Promise.all([
      this.prisma.document.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' } }),
      this.prisma.kycSession.findMany({
        where: { userId: req.user.id },
        select: { id: true, status: true, environment: true, consentAt: true, expiresAt: true },
        orderBy: { consentAt: 'desc' },
        take: 10,
      }),
      this.prisma.userProfile.findUnique({ where: { userId: req.user.id } }),
      this.prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, isVerified: true, dlValidUntil: true, phone: true, phoneVerifiedAt: true },
      }),
    ]);
    return {
      configured: this.sandbox.configured(),
      environment: this.sandbox.environment(),
      documents,
      sessions,
      profile,
      user,
    };
  }

  @Post('documents')
  async document(@Request() req: any, @Body() body: any) {
    const kind = choice(body.kind, 'Document type', DOCUMENT_KINDS);
    if (body.consent !== true) throw new BadRequestException('Consent is required for document verification');
    const mediaId = text(body.mediaId, 'Document image');
    const media = await this.prisma.media.findFirst({ where: { id: mediaId, ownerId: req.user.id, kind } });
    if (!media) throw new BadRequestException('Upload your document first');
    let vehicleId: string | undefined;
    if (!['DL', 'AADHAAR'].includes(kind)) {
      vehicleId = text(body.vehicleId, 'Vehicle');
      // Only the car's own host (an administrator included, for a car they host) can submit its documents.
      const car = await this.prisma.vehicle.findFirst({ where: { id: vehicleId, hostId: req.user.id } });
      if (!car) throw new NotFoundException('Your vehicle was not found');
    }
    return this.prisma.$transaction(async tx => {
      const existing = await tx.document.findFirst({ where: { mediaId } });
      if (existing) throw new BadRequestException('This document has already been submitted');
      const doc = await tx.document.create({
        data: {
          userId: req.user.id,
          kind,
          mediaId,
          vehicleId,
          documentFrontUrl: `/api/media/${mediaId}`,
        },
      });
      await tx.auditLog.create({
        data: { actorId: req.user.id, action: 'DOCUMENT_CONSENT', targetId: doc.id, detail: 'rental-document-v1' },
      });
      return doc;
    });
  }

  @Post('face-match')
  async verifyIdentityAndFaceMatch(@Request() req: any, @Body() body: any) {
    if (body.consent !== true) {
      throw new BadRequestException('Consent is required for Aadhaar and driving licence verification');
    }

    const rawAadhaar = String(body.aadhaarNumber || '').replace(/\D/g, '');
    if (rawAadhaar.length !== 12) {
      throw new BadRequestException('Enter a valid 12-digit Aadhaar number');
    }

    const rawDl = text(body.dlNumber, 'Driving Licence number', 30).toUpperCase().replace(/[\s-]/g, '');
    if (rawDl.length < 8) {
      throw new BadRequestException('Enter a valid Driving Licence number (e.g. GJ0120190012345)');
    }

    const dlExpiry = new Date(body.dlExpiryDate);
    if (!Number.isFinite(+dlExpiry) || dlExpiry <= new Date()) {
      throw new BadRequestException('Driving Licence expiry date must be valid and in the future');
    }

    const selfieMediaId = text(body.selfieMediaId, 'Live customer selfie');
    const selfieMedia = await this.prisma.media.findFirst({
      where: { id: selfieMediaId, ownerId: req.user.id },
    });
    if (!selfieMedia) {
      throw new BadRequestException('Please capture or upload your live selfie first');
    }

    // Optional document images must be the caller's own, unused AADHAAR/DL uploads.
    const ownDocumentImage = async (value: unknown, kind: 'AADHAAR' | 'DL') => {
      if (!value) return null;
      const id = text(value, kind === 'DL' ? 'Driving Licence image' : 'Aadhaar image', 100);
      const media = await this.prisma.media.findFirst({ where: { id, ownerId: req.user.id, vehicleId: null, kind } });
      if (!media) throw new BadRequestException('Upload the document image again');
      if (await this.prisma.document.findFirst({ where: { mediaId: id } })) throw new BadRequestException('This document has already been submitted');
      return id;
    };
    const aadhaarMediaId = await ownDocumentImage(body.aadhaarMediaId, 'AADHAAR');
    const dlMediaId = await ownDocumentImage(body.dlMediaId, 'DL');

    // There is no automated face matching: the details, document images and selfie are queued for an administrator,
    // who approves each document in the normal review (evidence viewed, expiry confirmed). Nothing is verified here.
    const aadhaarMasked = `XXXX-XXXX-${rawAadhaar.slice(-4)}`;
    const dlMasked = rawDl.length > 8 ? `${rawDl.slice(0, 4)}XXXXXXX${rawDl.slice(-4)}` : rawDl;
    const reviewNote = 'Submitted with a live selfie; awaiting administrator review';

    return this.prisma.$transaction(async tx => {
      const userRecord = await tx.user.findUnique({ where: { id: req.user.id } });
      if (!userRecord) throw new NotFoundException('User not found');
      const identity = {
        aadhaarNumberHash: this.sha256(`${req.user.id}:${rawAadhaar}`),
        aadhaarNumberMasked: aadhaarMasked,
        drivingLicenseHash: this.sha256(`${req.user.id}:${rawDl}`),
        drivingLicenseMasked: dlMasked,
        dlExpiryDate: dlExpiry,
        selfieMediaId,
        profileImageUrl: `/api/media/${selfieMediaId}`,
        faceMatchScore: null,
        faceMatchStatus: 'MANUAL_REVIEW',
      };
      const profile = await tx.userProfile.upsert({
        where: { userId: req.user.id },
        update: identity,
        create: {
          userId: req.user.id,
          firstName: userRecord.firstName,
          lastName: userRecord.lastName,
          city: body.city ? String(body.city).slice(0, 80) : 'Ahmedabad',
          state: 'Gujarat',
          isKycVerified: false,
          ...identity,
        },
      });

      // New pending records each time; earlier records (including approved ones) are kept as they were.
      const created: { id: string }[] = [];
      for (const [kind, mediaId, masked, validUntil] of [
        ['AADHAAR', aadhaarMediaId, aadhaarMasked, null],
        ['DL', dlMediaId, dlMasked, dlExpiry],
      ] as const) {
        created.push(await tx.document.create({
          data: {
            userId: req.user.id,
            kind,
            documentNumberMasked: masked,
            mediaId,
            documentFrontUrl: mediaId ? `/api/media/${mediaId}` : null,
            validUntil,
            status: 'PENDING',
            source: mediaId ? 'EKYC_FACE_MATCH' : 'DIGILOCKER_EKYC',
            reviewNote,
          },
        }));
      }

      await tx.auditLog.create({
        data: {
          actorId: req.user.id,
          action: 'KYC_FACE_MATCH_QUEUED',
          targetId: req.user.id,
          detail: `Aadhaar ${aadhaarMasked} · DL ${dlMasked} · selfie submitted for review`,
        },
      });

      return {
        autoVerified: false,
        faceMatchScore: null,
        aadhaarMasked,
        dlMasked,
        dlExpiryDate: dlExpiry,
        status: 'PENDING',
        documents: created.map(doc => doc.id),
        profile,
      };
    });
  }

  @Post('sessions')
  async start(@Request() req: any, @Body() body: any) {
    if (body.consent !== true) throw new BadRequestException('Consent is required to request Aadhaar and DL from DigiLocker');
    const result = await this.sandbox.call('/kyc/digilocker/sessions/init', 'POST', {
      '@entity': 'in.co.sandbox.kyc.digilocker.session.request',
      flow: 'signin',
      redirect_url: process.env.KYC_REDIRECT_URL,
      doc_types: ['aadhaar', 'driving_license'],
    });
    let url: URL;
    try {
      url = new URL(result.authorization_url);
    } catch {
      throw new BadGatewayException('Invalid provider redirect');
    }
    if (
      url.protocol !== 'https:' ||
      !['digilocker.meripehchaan.gov.in', 'digilocker.gov.in', 'www.digilocker.gov.in'].includes(url.hostname) ||
      typeof result.session_id !== 'string'
    ) {
      throw new BadGatewayException('Invalid provider redirect');
    }
    const session = await this.prisma.kycSession.create({
      data: {
        userId: req.user.id,
        providerId: result.session_id,
        environment: this.sandbox.environment(),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    return { id: session.id, authorizationUrl: url.toString() };
  }

  @Post('sessions/:id/sync')
  async sync(@Request() req: any, @Param('id') id: string) {
    const session = await this.prisma.kycSession.findFirst({ where: { id, userId: req.user.id } });
    if (!session) throw new NotFoundException('Session not found');
    if (session.environment !== this.sandbox.environment()) throw new BadRequestException('Session belongs to another provider environment');
    if (session.expiresAt < new Date()) throw new BadRequestException('Session expired. Start verification again.');
    const result = await this.sandbox.call('/kyc/digilocker/sessions/' + encodeURIComponent(session.providerId) + '/status');
    const status = text(result.status, 'Provider status', 50);
    await this.prisma.kycSession.update({ where: { id }, data: { status } });
    const syncResults: { kind: string; state: string; message?: string }[] = [];
    if (status.toLowerCase() !== 'succeeded') {
      return {
        ...(await this.status(req)),
        syncResults,
        syncMessage: 'DigiLocker consent is not complete. Complete the provider flow before syncing documents.',
      };
    }
    for (const kind of ['AADHAAR', 'DL']) {
      const existing = await this.prisma.document.findFirst({
        where: { userId: req.user.id, providerSessionId: id, kind },
        select: { id: true, mediaId: true },
      });
      if (existing?.mediaId) {
        syncResults.push({ kind, state: 'AVAILABLE' });
        continue;
      }
      let mediaId: string | null = null;
      try {
        const evidence = await this.documents.original({
          userId: req.user.id,
          kind,
          source: session.environment === 'live' ? 'DIGILOCKER_LIVE' : 'DIGILOCKER_TEST',
          providerSessionId: id,
          mediaId: null,
        });
        const archive = (this.documents as any).archive;
        if (typeof archive === 'function') mediaId = await archive.call(this.documents, req.user.id, kind, evidence);
      } catch (error) {
        syncResults.push({ kind, state: 'FAILED', message: error.message });
        continue;
      }
      await this.prisma.$transaction(async tx => {
        const current = await tx.document.findFirst({ where: { userId: req.user.id, providerSessionId: id, kind } });
        if (!current) {
          await tx.document.create({
            data: {
              userId: req.user.id,
              kind,
              providerSessionId: id,
              mediaId,
              source: session.environment === 'live' ? 'DIGILOCKER_LIVE' : 'DIGILOCKER_TEST',
              status: 'PENDING',
            },
          });
        } else if (mediaId && !current.mediaId) {
          await tx.document.update({ where: { id: current.id }, data: { mediaId } });
        }
      });
      syncResults.push({ kind, state: 'AVAILABLE' });
    }
    return { ...(await this.status(req)), syncResults };
  }

  @Get('documents/:id/certificate')
  async certificate(@Request() req: any, @Param('id') id: string, @Res() res: Response) {
    const evidence = await this.evidence(req, id);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.redirect(303, evidence.files[0].url);
  }

  @Get('documents/:id/evidence')
  async evidence(@Request() req: any, @Param('id') id: string) {
    const doc = await this.prisma.document.findFirst({ where: { id, userId: req.user.id } });
    if (!doc) throw new NotFoundException('Document not found');
    return this.documents.available(doc);
  }
}
