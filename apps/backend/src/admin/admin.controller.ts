import { Controller, Get, Post, Param, Body, Request, Res, Query, UseGuards, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DocumentEvidenceService } from '../kyc/document-evidence.service';
import { admin, choice, text, number, PHOTO_KINDS } from '../common/validation';
import { randomUUID } from 'node:crypto';
@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private prisma: PrismaService, private documents: DocumentEvidenceService) {}
  @Get()
  async overview(@Request() req: any, @Query() query: any = {}) {
    admin(req.user);
    const offset = query.offset === undefined ? 0 : number(query.offset, 'Offset', 0, 1000000, true);
    const [users, vehicles, bookings, documents, audit] = await Promise.all([
      this.prisma.user.findMany({ select: { id: true, firstName: true, lastName: true, email: true, role: true, isVerified: true, dlValidUntil: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: offset, take: 200 }),
      this.prisma.vehicle.findMany({ include: { media: { select: { id: true, kind: true } }, documents: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: offset, take: 200 }),
      this.prisma.booking.findMany({ include: { vehicle: true, payment: true, invoice: true, customer: { select: { firstName: true, lastName: true, email: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: offset, take: 200 }),
      this.prisma.document.findMany({ include: { user: { select: { firstName: true, lastName: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: offset, take: 200 }),
      this.prisma.auditLog.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: offset, take: 200 }),
    ]);
    return { users, vehicles, bookings, documents, audit, nextOffset: [users, vehicles, bookings, documents, audit].some(rows => rows.length === 200) ? offset + 200 : null };
  }
  // Redirect legacy certificate links to the original document after authorization.
  @Get('documents/:id/certificate')
  async certificate(@Request() req: any, @Param('id') id: string, @Res() res: Response) {
    const evidence = await this.evidence(req, id);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.redirect(303, evidence.files[0].url);
  }

  @Get('documents/:id/evidence')
  async evidence(@Request() req: any, @Param('id') id: string) {
    admin(req.user);
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    const evidence = await this.documents.available(doc);
    await this.prisma.auditLog.create({ data: { actorId: req.user.id, action: 'DOCUMENT_VIEWED', targetId: evidence.documentId || id, detail: doc.kind } });
    return evidence;
  }
  @Post('documents/:id/review')
  async review(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    admin(req.user);
    const status = choice(body.status, 'Decision', ['APPROVED', 'REJECTED']);
    const note = text(body.note, 'Review reason', 1000);
    let validUntil: Date | null = null;
    if (status === 'APPROVED' && body.validUntil) {
      validUntil = new Date(body.validUntil + 'T23:59:59.999Z');
      if (!Number.isFinite(+validUntil) || validUntil <= new Date()) throw new BadRequestException('Enter a future document expiry date');
    }
    return this.prisma.$transaction(async tx => {
      const doc = await tx.document.findUnique({ where: { id } });
      if (!doc) throw new NotFoundException();
      if (doc.source === 'DIGILOCKER_TEST' && status === 'APPROVED') throw new BadRequestException('Trial documents cannot grant rental eligibility');
      if (status === 'APPROVED' && doc.kind !== 'AADHAAR' && !validUntil) throw new BadRequestException('Expiry date is required');
      if (status === 'APPROVED' && body.identityChecked !== true) throw new BadRequestException('Confirm identity, expiry and applicable vehicle class against the source document');
      if (status === 'APPROVED') {
        const viewed = await tx.auditLog.findFirst({ where: { actorId: req.user.id, action: 'DOCUMENT_VIEWED', targetId: id, createdAt: { gte: new Date(Date.now() - 15 * 60000) } }, orderBy: { createdAt: 'desc' } });
        if (!viewed || viewed.createdAt < doc.updatedAt) throw new BadRequestException('Retrieve and inspect this record’s original document before approving. Refresh evidence if the record has changed.');
      }
      const result = await tx.document.update({ where: { id }, data: { status, reviewNote: note, validUntil } });
      if (!doc.vehicleId) {
        const approved = await tx.document.findMany({ where: { userId: doc.userId, status: 'APPROVED', source: { not: 'DIGILOCKER_TEST' } } });
        const dl = approved.filter(d => d.kind === 'DL' && d.validUntil && d.validUntil > new Date()).sort((a,b) => +b.validUntil! - +a.validUntil!)[0];
        await tx.user.update({ where: { id: doc.userId }, data: { isVerified: Boolean(dl && approved.some(d => d.kind === 'AADHAAR')), dlValidUntil: dl?.validUntil || null } });
      } else if (status === 'REJECTED') {
        await tx.vehicle.update({ where: { id: doc.vehicleId }, data: { status: 'PENDING_APPROVAL' } });
      }
      await tx.auditLog.create({ data: { actorId: req.user.id, action: 'DOCUMENT_' + status, targetId: id, detail: note } });
      return result;
    });
  }
  @Post('vehicles/:id/review')
  async vehicle(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    admin(req.user);
    const status = choice(body.status, 'Status', ['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'PENDING_APPROVAL']) as any;
    const reviewNote = text(body.note, 'Review reason', 1000);
    return this.prisma.$transaction(async tx => {
      const car = await tx.vehicle.findUnique({ where: { id }, include: { media: true, documents: true } });
      if (!car) throw new NotFoundException();
      if (car.hostId === req.user.id) throw new BadRequestException('Another administrator must review your listing');
      if (status === 'ACTIVE') {
        if (!car.registrationNumber || !PHOTO_KINDS.every(k => car.media.some(m => m.kind === k))) throw new BadRequestException('All required photos and registration are needed');
        if (!['RC','INSURANCE','PUC'].every(k => car.documents.some(d => d.kind === k && d.status === 'APPROVED' && d.validUntil && d.validUntil > new Date()))) throw new BadRequestException('Approve valid RC, insurance and PUC first');
      }
      const result = await tx.vehicle.update({ where: { id }, data: { status, reviewNote } });
      await tx.auditLog.create({ data: { actorId: req.user.id, action: 'VEHICLE_' + status, targetId: id, detail: reviewNote } });
      return result;
    });
  }
  @Post('bookings/:id/payment')
  async payment(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    admin(req.user);
    const reference = text(body.reference, 'Bank/payment reference', 100);
    const amount = number(body.amount, 'Amount received', 1, 90000000);
    if (body.received !== true) throw new BadRequestException('Confirm receipt in your bank or payment account');
    return this.prisma.$transaction(async tx => {
      const booking = await tx.booking.findUnique({ where: { id }, include: { vehicle: true, customer: true, payment: true, invoice: true } });
      if (!booking) throw new NotFoundException();
      if (booking.payment?.transactionId === reference && booking.payment.status === 'SUCCESS' && Number(booking.payment.amount) === amount) return booking.invoice;
      if (booking.status !== 'PENDING' || !booking.expiresAt || booking.expiresAt <= new Date() || booking.startDate <= new Date()) throw new BadRequestException('Reservation expired or is not awaiting payment');
      if (amount !== Number(booking.totalAmount)) throw new BadRequestException('Received amount must match the booking total');
      if (!booking.customer.isVerified || !booking.customer.dlValidUntil || booking.customer.dlValidUntil < booking.endDate || booking.vehicle.status !== 'ACTIVE') throw new BadRequestException('KYC or vehicle eligibility changed');
      const changed = await tx.booking.updateMany({ where: { id, status: 'PENDING', expiresAt: { gt: new Date() } }, data: { status: 'CONFIRMED', expiresAt: null } });
      if (changed.count !== 1) throw new ConflictException('Reservation changed');
      await tx.payment.create({ data: { bookingId: id, transactionId: reference, amount, status: 'SUCCESS' } });
      const invoice = await tx.invoice.create({ data: { bookingId: id, number: 'SF-' + new Date().getUTCFullYear() + '-' + randomUUID().toUpperCase(), amount,
        snapshot: JSON.stringify({ business: process.env.BUSINESS_NAME || 'Safar Self Drive', address: process.env.BUSINESS_ADDRESS || '', customer: booking.customer.firstName + ' ' + booking.customer.lastName,
          email: booking.customer.email, vehicle: booking.vehicle.make + ' ' + booking.vehicle.model, registration: booking.vehicle.registrationNumber,
          startDate: booking.startDate, endDate: booking.endDate, dailyRate: Number(booking.dailyRate), rentalDays: booking.rentalDays, paymentReference: reference,
          securityDeposit: Number(booking.securityDeposit), rentalAmount: Number(booking.totalAmount) - Number(booking.securityDeposit), includedKilometres: booking.includedKilometres,
          description: 'Rental payment receipt. Tax invoice configuration pending.' }) } });
      await tx.auditLog.create({ data: { actorId: req.user.id, action: 'PAYMENT_RECORDED', targetId: id, detail: reference } });
      return invoice;
    });
  }
  @Post('vehicles/:id/pricing')
  async pricing(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    admin(req.user);
    const rate = number(body.pricePerDay, 'Daily rate', 1, 1000000);
    if (Math.abs(rate * 100 - Math.round(rate * 100)) > 0.000001) throw new BadRequestException('Use at most two decimal places');
    const expectedRate = number(body.expectedRate, 'Previous daily rate', 1, 1000000);
    const reason = text(body.reason, 'Reason', 1000);
    return this.prisma.$transaction(async tx => {
      const changed = await tx.vehicle.updateMany({ where: { id, pricePerDay: expectedRate }, data: { pricePerDay: rate } });
      if (changed.count !== 1) throw new ConflictException('Vehicle or price changed. Refresh before editing.');
      await tx.auditLog.create({ data: { actorId: req.user.id, action: 'VEHICLE_PRICE_UPDATED', targetId: id, detail: JSON.stringify({ from: expectedRate, to: rate, reason }) } });
      return { pricePerDay: rate };
    });
  }
  @Post('bookings/:id/hold')
  async hold(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    admin(req.user);
    const action = choice(body.action, 'Hold action', ['EXTEND', 'RELEASE']);
    const reason = text(body.reason, 'Reason', 1000);
    const minutes = action === 'EXTEND' ? number(body.minutes, 'Minutes from now', 1, 120, true) : 0;
    return this.prisma.$transaction(async tx => {
      const initial = await tx.booking.findUnique({ where: { id } });
      if (!initial) throw new NotFoundException('Booking not found');
      await tx.vehicle.update({ where: { id: initial.vehicleId }, data: { updatedAt: new Date() } });
      const booking = await tx.booking.findUnique({ where: { id }, include: { payment: true } });
      const now = new Date();
      if (!booking || booking.status !== 'PENDING' || !booking.expiresAt || booking.expiresAt <= now || booking.startDate <= now || booking.payment) throw new ConflictException('Only a live unpaid checkout hold can be changed. Refresh bookings.');
      const expiresAt = new Date(Math.min(+now + minutes * 60000, +booking.startDate));
      if (action === 'EXTEND' && expiresAt <= booking.expiresAt) throw new BadRequestException('Choose an expiry later than the current hold expiry');
      const changed = await tx.booking.updateMany({ where: { id, status: 'PENDING', expiresAt: booking.expiresAt }, data: action === 'RELEASE' ? { status: 'CANCELLED', expiresAt: null } : { expiresAt } });
      if (changed.count !== 1) throw new ConflictException('Booking changed. Refresh and retry.');
      await tx.auditLog.create({ data: { actorId: req.user.id, action: 'BOOKING_HOLD_' + action, targetId: id, detail: JSON.stringify({ reason, expiresAt: action === 'EXTEND' ? expiresAt : null }) } });
      return { updated: true };
    });
  }
  @Post('bookings/:id/refund')
  async refund(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    admin(req.user);
    const reference = text(body.reference, 'Refund bank reference');
    if (body.refunded !== true) throw new BadRequestException('Confirm the refund has been sent');
    return this.prisma.$transaction(async tx => {
      const changed = await tx.payment.updateMany({ where: { bookingId: id, status: 'REFUND_PENDING' }, data: { status: 'REFUNDED' } });
      if (changed.count !== 1) throw new BadRequestException('No pending refund');
      await tx.invoice.updateMany({ where: { bookingId: id }, data: { status: 'REFUNDED' } });
      await tx.auditLog.create({ data: { actorId: req.user.id, action: 'REFUND_RECORDED', targetId: id, detail: reference } });
      return { message: 'Refund recorded' };
    });
  }
}
