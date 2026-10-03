import { Controller, Get, Post, Body, Param, Request, Res, UseGuards, BadRequestException, NotFoundException, BadGatewayException } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { SandboxService } from './sandbox.service';
import { choice, DOCUMENT_KINDS, text } from '../common/validation';
import { DocumentEvidenceService } from './document-evidence.service';
@Controller('kyc')
@UseGuards(JwtAuthGuard)
export class KycController {
  constructor(private prisma: PrismaService, private sandbox: SandboxService, private documents: DocumentEvidenceService) {}
  @Get()
  async status(@Request() req: any) {
    return {
      configured: this.sandbox.configured(), environment: this.sandbox.environment(),
      documents: await this.prisma.document.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' } }),
      sessions: await this.prisma.kycSession.findMany({ where: { userId: req.user.id }, select: { id: true, status: true, environment: true, consentAt: true, expiresAt: true }, orderBy: { consentAt: 'desc' }, take: 10 }),
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
    if (kind !== 'DL') {
      vehicleId = text(body.vehicleId, 'Vehicle');
      const car = await this.prisma.vehicle.findFirst({ where: { id: vehicleId, hostId: req.user.id } });
      if (!car) throw new NotFoundException('Your vehicle was not found');
    }
    return this.prisma.$transaction(async tx => {
      const existing = await tx.document.findFirst({ where: { mediaId } });
      if (existing) throw new BadRequestException('This document has already been submitted');
      const doc = await tx.document.create({ data: { userId: req.user.id, kind, mediaId, vehicleId } });
      await tx.auditLog.create({ data: { actorId: req.user.id, action: 'DOCUMENT_CONSENT', targetId: doc.id, detail: 'rental-document-v1' } });
      return doc;
    });
  }
  @Post('sessions')
  async start(@Request() req: any, @Body() body: any) {
    if (body.consent !== true) throw new BadRequestException('Consent is required to request Aadhaar and DL from DigiLocker');
    const result = await this.sandbox.call('/kyc/digilocker/sessions/init', 'POST', {
      '@entity': 'in.co.sandbox.kyc.digilocker.session.request', flow: 'signin',
      redirect_url: process.env.KYC_REDIRECT_URL, doc_types: ['aadhaar', 'driving_license'],
    });
    let url: URL;
    try { url = new URL(result.authorization_url); } catch { throw new BadGatewayException('Invalid provider redirect'); }
    if (url.protocol !== 'https:' || !['digilocker.meripehchaan.gov.in', 'digilocker.gov.in', 'www.digilocker.gov.in'].includes(url.hostname) || typeof result.session_id !== 'string') throw new BadGatewayException('Invalid provider redirect');
    const session = await this.prisma.kycSession.create({ data: { userId: req.user.id, providerId: result.session_id, environment: this.sandbox.environment(), expiresAt: new Date(Date.now() + 3600000) } });
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
    if (status.toLowerCase() !== 'succeeded') return { ...await this.status(req), syncResults, syncMessage: 'DigiLocker consent is not complete. Complete the provider flow before syncing documents.' };
    // A redirect or a session status never grants KYC approval. Fetching each issuer document is required.
    for (const kind of ['AADHAAR', 'DL']) {
      try { await this.documents.original({ userId: req.user.id, kind, source: session.environment === 'live' ? 'DIGILOCKER_LIVE' : 'DIGILOCKER_TEST', providerSessionId: id, mediaId: null }); }
      catch (error) { syncResults.push({ kind, state: 'FAILED', message: error.message }); continue; }
      await this.prisma.$transaction(async tx => {
        const exists = await tx.document.findFirst({ where: { userId: req.user.id, providerSessionId: id, kind } });
        if (!exists) await tx.document.create({ data: { userId: req.user.id, kind, providerSessionId: id, source: session.environment === 'live' ? 'DIGILOCKER_LIVE' : 'DIGILOCKER_TEST', status: 'PENDING' } });
      });
      syncResults.push({ kind, state: 'AVAILABLE' });
    }
    return { ...await this.status(req), syncResults };
  }
  // Keep old saved links working, but never generate a replacement certificate.
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
