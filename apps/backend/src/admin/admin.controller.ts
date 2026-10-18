import { Controller, Get, Post, Param, Body, Request, Res, Query, UseGuards, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DocumentEvidenceService } from '../kyc/document-evidence.service';
import { admin, choice, text, number, PHOTO_KINDS } from '../common/validation';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { rentalPolicy, lateReturnCharge } from '../bookings/rental-policy';
@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private prisma: PrismaService, private documents: DocumentEvidenceService) {}
  @Get()
  async overview(@Request() req: any, @Query() query: any = {}) {
    admin(req.user);
    const offset = query.offset === undefined ? 0 : number(query.offset, 'Offset', 0, 1000000, true);
    const search = typeof query.q === 'string' && query.q.trim() ? query.q.trim().slice(0, 100) : undefined;
    const vehicleStatus = query.vehicleStatus ? choice(query.vehicleStatus, 'Vehicle status', ['ACTIVE', 'PENDING_APPROVAL', 'INACTIVE', 'MAINTENANCE']) : undefined;
    const bookingStatus = query.bookingStatus ? choice(query.bookingStatus, 'Booking status', ['PENDING', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED']) : undefined;
    const documentStatus = query.documentStatus ? choice(query.documentStatus, 'Document status', ['PENDING', 'APPROVED', 'REJECTED']) : undefined;
    const role = query.role ? choice(query.role, 'User role', ['CUSTOMER', 'HOST', 'DEALER', 'ADMIN']) : undefined;
    const [users, vehicles, bookings, documents, audit] = await Promise.all([
      this.prisma.user.findMany({ where: { ...(role ? { role: role as any } : {}), ...(search ? { OR: [{ email: { contains: search } }, { firstName: { contains: search } }, { lastName: { contains: search } }] } : {}) }, select: { id: true, firstName: true, lastName: true, email: true, phone: true, phoneVerifiedAt: true, role: true, isVerified: true, isBlocked: true, dlValidUntil: true, profileImage: true, profile: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: offset, take: 200 }),
      this.prisma.vehicle.findMany({ where: { ...(vehicleStatus ? { status: vehicleStatus as any } : {}), ...(search ? { OR: [{ make: { contains: search } }, { model: { contains: search } }, { registrationNumber: { contains: search } }, { locationCity: { contains: search } }] } : {}) }, include: { media: { select: { id: true, kind: true } }, documents: true, currentHub: true, host: { select: { firstName: true, lastName: true, email: true, phone: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: offset, take: 200 }),
      this.prisma.booking.findMany({ where: { ...(bookingStatus ? { status: bookingStatus as any } : {}), ...(search ? { OR: [{ bookingRef: { contains: search } }, { vehicle: { make: { contains: search } } }, { vehicle: { model: { contains: search } } }, { customer: { email: { contains: search } } }] } : {}) }, include: { vehicle: { include: { host: { select: { firstName: true, lastName: true, email: true, phone: true } }, currentHub: true } }, payment: true, invoice: true, trip: true, inspections: true, customer: { select: { firstName: true, lastName: true, email: true, phone: true, profile: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: offset, take: 200 }),
      this.prisma.document.findMany({ where: { ...(documentStatus ? { status: documentStatus } : {}), ...(search ? { OR: [{ kind: { contains: search } }, { user: { email: { contains: search } } }, { user: { firstName: { contains: search } } }, { user: { lastName: { contains: search } } }] } : {}) }, include: { user: { select: { firstName: true, lastName: true, email: true, phone: true, profile: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: offset, take: 200 }),
      this.prisma.auditLog.findMany({ where: search ? { OR: [{ action: { contains: search } }, { targetId: { contains: search } }, { detail: { contains: search } }] } : {}, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: offset, take: 200 }),
    ]);
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const [vehiclePending, documentPending, refunds, activeBookings, todayRevenue, paidRevenue, bookingRevenueAgg] = await Promise.all([
      this.prisma.vehicle.count({ where: { status: 'PENDING_APPROVAL' } }),
      this.prisma.document.count({ where: { status: 'PENDING' } }),
      this.prisma.payment.count({ where: { status: 'REFUND_PENDING' } }),
      this.prisma.booking.count({ where: { status: { in: ['CONFIRMED', 'ACTIVE'] } } }),
      this.prisma.payment.aggregate({ where: { status: 'SUCCESS', createdAt: { gte: today } }, _sum: { amount: true } }),
      this.prisma.payment.aggregate({ where: { status: 'SUCCESS' }, _sum: { amount: true } }),
      this.prisma.booking.aggregate({ where: { status: { in: ['CONFIRMED', 'ACTIVE', 'COMPLETED'] } }, _sum: { platformFee: true, hostRevenue: true, securityDeposit: true } }),
    ]);
    return { users, vehicles, bookings, documents, audit, metrics: { vehiclePending, documentPending, refunds, activeBookings, todayRevenue: Number(todayRevenue._sum.amount || 0), paidRevenue: Number(paidRevenue._sum.amount || 0), platformRevenue: Number(bookingRevenueAgg._sum.platformFee || 0), hostRevenue: Number(bookingRevenueAgg._sum.hostRevenue || 0), depositEscrow: Number(bookingRevenueAgg._sum.securityDeposit || 0) }, nextOffset: [users, vehicles, bookings, documents, audit].some(rows => rows.length === 200) ? offset + 200 : null };
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
  @Post('vehicles')
  async createVehicle(@Request() req: any, @Body() body: any) {
    admin(req.user);
    const make = text(body.make, 'Make', 50);
    const model = text(body.model, 'Model', 50);
    const year = number(body.year, 'Year', 2000, 2030, true);
    const registrationNumber = text(body.registrationNumber, 'Registration number', 30).toUpperCase();
    const locationCity = text(body.city || body.locationCity, 'City', 50);
    const category = text(body.category || 'SUV', 'Category', 30);
    const transmission = choice(body.transmission || 'AUTOMATIC', 'Transmission', ['MANUAL', 'AUTOMATIC']);
    const fuelType = choice(body.fuelType || 'PETROL', 'Fuel type', ['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'CNG']);
    const seats = number(body.seats || 5, 'Seats', 1, 50, true);
    const pricePerDay = number(body.pricePerDay, 'Daily rate', 1, 1000000);
    const odometer = body.odometer ? number(body.odometer, 'Odometer', 0, 1000000, true) : 5000;
    const images = typeof body.images === 'string' && body.images.trim()
      ? body.images.trim()
      : 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80';

    const existing = await this.prisma.vehicle.findUnique({ where: { registrationNumber } });
    if (existing) throw new BadRequestException('Vehicle with registration number ' + registrationNumber + ' already exists');

    return this.prisma.$transaction(async tx => {
      const vehicle = await tx.vehicle.create({
        data: {
          hostId: req.user.id,
          make,
          model,
          year,
          category,
          transmission,
          fuelType,
          seats,
          pricePerDay,
          status: 'ACTIVE',
          locationCity,
          registrationNumber,
          odometer,
          images,
        }
      });

      for (const kind of PHOTO_KINDS) {
        await tx.media.create({
          data: {
            ownerId: req.user.id,
            vehicleId: vehicle.id,
            kind,
            storageKey: 'fleet-' + vehicle.id + '-' + kind.toLowerCase() + '.jpg',
            mimeType: 'image/jpeg',
            size: 102400,
            sha256: randomUUID().replace(/-/g, ''),
          }
        });
      }

      const threeYearsLater = new Date();
      threeYearsLater.setFullYear(threeYearsLater.getFullYear() + 3);

      for (const kind of ['RC', 'INSURANCE', 'PUC']) {
        await tx.document.create({
          data: {
            userId: req.user.id,
            vehicleId: vehicle.id,
            kind,
            status: 'APPROVED',
            source: 'ADMIN_FLEET_UPLOAD',
            validUntil: threeYearsLater,
            reviewNote: 'Fleet vehicle compliance verified on creation by admin',
          }
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: req.user.id,
          action: 'VEHICLE_CREATED_BY_ADMIN',
          targetId: vehicle.id,
          detail: JSON.stringify({ make, model, registrationNumber, pricePerDay })
        }
      });

      return vehicle;
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
  @Post('users/:id/block')
  async blockUser(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    admin(req.user);
    const blocked = body.blocked === true;
    const note = text(body.note, 'Reason', 1000);
    return this.prisma.$transaction(async tx => {
      const target = await tx.user.findUnique({ where: { id }, select: { id: true, role: true, isBlocked: true } });
      if (!target) throw new NotFoundException('User not found');
      if (target.role === 'ADMIN' || target.id === req.user.id) throw new BadRequestException('Administrators cannot be blocked from this panel');
      const result = await tx.user.update({ where: { id }, data: { isBlocked: blocked } });
      await tx.auditLog.create({ data: { actorId: req.user.id, action: blocked ? 'USER_BLOCKED' : 'USER_UNBLOCKED', targetId: id, detail: note } });
      return { id: result.id, isBlocked: result.isBlocked };
    });
  }
  @Get('export.csv')
  async exportCsv(@Request() req: any, @Query() query: any, @Res() res: Response) {
    admin(req.user);
    const from = query.from ? new Date(query.from + 'T00:00:00.000Z') : undefined;
    const to = query.to ? new Date(query.to + 'T23:59:59.999Z') : undefined;
    if ((from && !Number.isFinite(+from)) || (to && !Number.isFinite(+to))) throw new BadRequestException('Invalid export date range');
    const bookings = await this.prisma.booking.findMany({ where: { ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) }, include: { customer: { select: { firstName: true, lastName: true, email: true } }, vehicle: { include: { host: { select: { firstName: true, lastName: true, email: true } } } }, payment: true, invoice: true }, orderBy: { createdAt: 'desc' }, take: 10000 });
    const cell = (value: unknown) => '"' + String(value ?? '').replace(/"/g, '""') + '"';
    const rows: Array<Array<string | number>> = [['Booking reference','Created at','Customer','Customer email','Host','Vehicle','Registration','Pickup','Return','Status','Rental amount','Security deposit','Total','Payment status','Payment reference','Invoice']];
    for (const booking of bookings) rows.push([booking.bookingRef, booking.createdAt.toISOString(), booking.customer.firstName + ' ' + booking.customer.lastName, booking.customer.email, booking.vehicle.host.firstName + ' ' + booking.vehicle.host.lastName, booking.vehicle.make + ' ' + booking.vehicle.model, booking.vehicle.registrationNumber || '', booking.startDate.toISOString(), booking.endDate.toISOString(), booking.status, Number(booking.totalAmount) - Number(booking.securityDeposit), Number(booking.securityDeposit), Number(booking.totalAmount), booking.payment?.status || 'NOT_RECORDED', booking.payment?.transactionId || '', booking.invoice?.number || '']);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="safar-bookings-mis.csv"');
    res.send(rows.map(row => row.map(cell).join(',')).join('\r\n'));
  }
  @Get('bookings/:id/settlement')
  async settlement(@Request() req: any, @Param('id') id: string) {
    admin(req.user);
    const booking = await this.prisma.booking.findUnique({ where: { id }, include: { vehicle: true, inspections: { orderBy: { createdAt: 'asc' } } } });
    if (!booking) throw new NotFoundException('Booking not found');
    const pickup = booking.inspections.find(item => item.stage === 'PICKUP');
    const returned = booking.inspections.find(item => item.stage === 'RETURN');
    const travelled = pickup && returned ? Math.max(0, returned.odometer - pickup.odometer) : null;
    const excessKm = travelled == null || booking.includedKilometres == null ? null : Math.max(0, travelled - booking.includedKilometres);
    const excessCharge = excessKm == null ? 0 : excessKm * rentalPolicy.excessKmRate;
    const late = returned ? lateReturnCharge(returned.createdAt, booking.endDate) : { lateMinutes: 0, lateHours: 0, amount: 0 };
    const automaticCharges = excessCharge + late.amount;
    return { bookingId: id, depositHeld: Number(booking.securityDeposit), includedKilometres: booking.includedKilometres, travelledKilometres: travelled, excessKilometres: excessKm, excessKmRate: rentalPolicy.excessKmRate, excessCharge, lateGraceMinutes: rentalPolicy.lateGraceMinutes, lateMinutes: late.lateMinutes, lateCharge: late.amount, automaticCharges, suggestedDepositDeduction: Math.min(Number(booking.securityDeposit), automaticCharges), estimatedDepositRelease: Math.max(0, Number(booking.securityDeposit) - automaticCharges), damageReviewRequired: Boolean(returned?.damageNote && !/^no visible damage$/i.test(returned.damageNote.trim())), note: 'Damage, fuel, tolls, fines and cleaning require documented admin review before any additional deduction.' };
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

  @Post('users/:id/password')
  async resetUserPassword(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    admin(req.user);
    const password = text(body.password, 'Password', 72);
    if (password.length < 8) throw new BadRequestException('Password must be at least 8 characters');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    return this.prisma.$transaction(async tx => {
      const user = await tx.user.findUnique({ where: { id } });
      if (!user) throw new NotFoundException('User not found');
      await tx.user.update({ where: { id }, data: { passwordHash } });
      await tx.auditLog.create({
        data: {
          actorId: req.user.id,
          action: 'USER_PASSWORD_RESET',
          targetId: id,
          detail: `Password reset by administrator for ${user.email}`,
        },
      });
      return { success: true, message: `Password successfully updated for ${user.email}` };
    });
  }

  @Get('bookings/:id/swap-candidates')
  async swapCandidates(@Request() req: any, @Param('id') id: string) {
    admin(req.user);
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { vehicle: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        id: { not: booking.vehicleId },
        status: 'ACTIVE',
      },
      include: {
        bookings: {
          where: {
            id: { not: id },
            status: { in: ['CONFIRMED', 'ACTIVE'] },
            startDate: { lt: booking.endDate },
            endDate: { gt: booking.startDate },
          },
        },
        availabilityBlocks: {
          where: {
            releasedAt: null,
            startDate: { lt: booking.endDate },
            endDate: { gt: booking.startDate },
          },
        },
      },
    });
    const candidates = vehicles
      .filter(v => v.bookings.length === 0 && v.availabilityBlocks.length === 0)
      .map(v => ({
        id: v.id,
        make: v.make,
        model: v.model,
        year: v.year,
        registrationNumber: v.registrationNumber,
        category: v.category,
        pricePerDay: Number(v.pricePerDay),
        locationCity: v.locationCity,
        seats: v.seats,
      }));
    return { currentBooking: booking, candidates };
  }

  @Post('bookings/:id/swap')
  async swapBooking(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    admin(req.user);
    const newVehicleId = text(body.newVehicleId, 'New vehicle ID', 80);
    const reason = text(body.reason, 'Reason for swapping', 1000);
    return this.prisma.$transaction(async tx => {
      const booking = await tx.booking.findUnique({
        where: { id },
        include: { vehicle: true },
      });
      if (!booking) throw new NotFoundException('Booking not found');
      if (['CANCELLED', 'COMPLETED'].includes(booking.status)) {
        throw new BadRequestException('Cannot swap a cancelled or completed booking');
      }
      if (booking.vehicleId === newVehicleId) {
        throw new BadRequestException('Select a different replacement vehicle');
      }
      const newCar = await tx.vehicle.findUnique({ where: { id: newVehicleId } });
      if (!newCar || newCar.status !== 'ACTIVE') {
        throw new BadRequestException('Replacement vehicle is not active in fleet');
      }
      const conflict = await tx.booking.findFirst({
        where: {
          id: { not: id },
          vehicleId: newVehicleId,
          status: { in: ['CONFIRMED', 'ACTIVE'] },
          startDate: { lt: booking.endDate },
          endDate: { gt: booking.startDate },
        },
      });
      if (conflict) {
        throw new ConflictException('Replacement vehicle is already booked for these dates');
      }
      const oldCar = booking.vehicle;
      await tx.booking.update({
        where: { id },
        data: { vehicleId: newVehicleId },
      });
      await tx.auditLog.create({
        data: {
          actorId: req.user.id,
          action: 'BOOKING_VEHICLE_SWAPPED',
          targetId: id,
          detail: `Transferred from ${oldCar.make} ${oldCar.model} (${oldCar.registrationNumber}) to ${newCar.make} ${newCar.model} (${newCar.registrationNumber}). Reason: ${reason}`,
        },
      });
      return {
        success: true,
        message: `Booking successfully transferred to ${newCar.make} ${newCar.model} (${newCar.registrationNumber})`,
      };
    });
  }

  @Post('bookings/:id/cancel')
  async adminCancelBooking(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    admin(req.user);
    const reason = text(body.reason, 'Cancellation reason', 1000);
    return this.prisma.$transaction(async tx => {
      const booking = await tx.booking.findUnique({ where: { id }, include: { payment: true } });
      if (!booking) throw new NotFoundException('Booking not found');
      if (['CANCELLED', 'COMPLETED'].includes(booking.status)) {
        throw new BadRequestException(`Booking is already ${booking.status.toLowerCase()}`);
      }
      await tx.booking.update({ where: { id }, data: { status: 'CANCELLED' } });
      if (booking.payment && booking.payment.status === 'SUCCESS') {
        await tx.payment.update({ where: { id: booking.payment.id }, data: { status: 'REFUND_PENDING' } });
        await tx.invoice.updateMany({ where: { bookingId: id }, data: { status: 'REFUND_PENDING' } });
      }
      await tx.auditLog.create({
        data: {
          actorId: req.user.id,
          action: 'ADMIN_BOOKING_CANCELLED',
          targetId: id,
          detail: `Cancelled by administrator. Reason: ${reason}`,
        },
      });
      return { success: true, message: 'Booking cancelled by admin', refundPending: booking.payment?.status === 'SUCCESS' };
    });
  }

  @Post('users/:id/verify-kyc')
  async adminVerifyUserKyc(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    admin(req.user);
    const verified = body.verified !== false;
    const dlExpiry = body.dlValidUntil ? new Date(body.dlValidUntil) : new Date('2029-12-31T23:59:59Z');
    return this.prisma.$transaction(async tx => {
      const user = await tx.user.update({
        where: { id },
        data: {
          isVerified: verified,
          dlValidUntil: verified ? dlExpiry : null,
          phoneVerifiedAt: verified ? new Date() : undefined,
        },
      });
      await tx.userProfile.upsert({
        where: { userId: id },
        update: {
          isKycVerified: verified,
          dlExpiryDate: verified ? dlExpiry : null,
          faceMatchStatus: verified ? 'ADMIN_APPROVED' : 'REJECTED',
        },
        create: {
          userId: id,
          firstName: user.firstName,
          lastName: user.lastName,
          isKycVerified: verified,
          dlExpiryDate: verified ? dlExpiry : null,
          faceMatchStatus: verified ? 'ADMIN_APPROVED' : 'REJECTED',
        },
      });
      if (verified) {
        await tx.document.updateMany({
          where: { userId: id },
          data: { status: 'APPROVED', verifiedById: req.user.id, verifiedAt: new Date(), validUntil: dlExpiry },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: req.user.id,
          action: verified ? 'ADMIN_KYC_APPROVED' : 'ADMIN_KYC_REVOKED',
          targetId: id,
          detail: body.note ? String(body.note).slice(0, 500) : `Admin ${verified ? 'approved' : 'revoked'} driver e-KYC`,
        },
      });
      return { success: true, isVerified: verified };
    });
  }

  @Post('documents/:id/quick-review')
  async quickReviewDocument(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    admin(req.user);
    const status = choice(body.status, 'Decision', ['APPROVED', 'REJECTED']);
    const note = text(body.note || (status === 'APPROVED' ? 'Approved by Admin Operations' : 'Rejected by Admin Operations'), 'Note', 1000);
    const validUntil = body.validUntil ? new Date(body.validUntil) : new Date('2029-12-31T23:59:59Z');
    return this.prisma.$transaction(async tx => {
      const doc = await tx.document.findUnique({ where: { id } });
      if (!doc) throw new NotFoundException('Document not found');
      const updated = await tx.document.update({
        where: { id },
        data: {
          status,
          reviewNote: note,
          validUntil: status === 'APPROVED' ? validUntil : doc.validUntil,
          verifiedById: req.user.id,
          verifiedAt: status === 'APPROVED' ? new Date() : null,
        },
      });
      if (!doc.vehicleId && status === 'APPROVED') {
        await tx.user.update({
          where: { id: doc.userId },
          data: { isVerified: true, dlValidUntil: validUntil },
        });
        await tx.userProfile.updateMany({
          where: { userId: doc.userId },
          data: { isKycVerified: true, dlExpiryDate: validUntil },
        });
      }
      await tx.auditLog.create({
        data: { actorId: req.user.id, action: 'DOCUMENT_' + status, targetId: id, detail: note },
      });
      return updated;
    });
  }

  @Get('disputes')
  async listDisputes(@Request() req: any) {
    admin(req.user);
    const logs = await this.prisma.auditLog.findMany({
      where: { action: 'BOOKING_DISPUTE' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    if (!logs.length) return [];
    const actorIds = [...new Set(logs.map(l => l.actorId))];
    const [actors, responses] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, firstName: true, lastName: true, email: true, phone: true },
      }),
      this.prisma.auditLog.findMany({
        where: { action: 'DISPUTE_RESPONSE', targetId: { in: logs.map(l => l.id) } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    const actorMap = new Map(actors.map(a => [a.id, a]));
    return logs.map(log => {
      let parsed: any = {};
      try { parsed = JSON.parse(log.detail || '{}'); } catch {}
      const history = responses.filter(r => r.targetId === log.id).map(r => {
        let rp: any = {};
        try { rp = JSON.parse(r.detail || '{}'); } catch { rp = { note: r.detail }; }
        return { id: r.id, status: rp.status || 'UNDER_REVIEW', note: rp.note || r.detail, createdAt: r.createdAt };
      });
      const latestStatus = history.length ? history[history.length - 1].status : (parsed.status || 'SUBMITTED');
      const latestResponse = history.length ? history[history.length - 1].note : null;
      return {
        id: log.id,
        reference: parsed.reference || ('DSP-' + log.id.slice(0, 8).toUpperCase()),
        bookingId: parsed.bookingId || log.targetId,
        bookingRef: parsed.bookingRef || '—',
        vehicleTitle: parsed.vehicleTitle || 'Self-Drive Vehicle',
        category: parsed.category || 'BILLING',
        description: parsed.description || '',
        amountClaimed: parsed.amountClaimed || 0,
        mediaId: parsed.mediaId || null,
        status: latestStatus,
        adminResponse: latestResponse,
        customer: actorMap.get(log.actorId) || null,
        history,
        createdAt: log.createdAt,
      };
    });
  }

  @Post('disputes/:id/resolve')
  async resolveDispute(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    admin(req.user);
    const status = choice(body.status, 'Dispute status', ['SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUIRED', 'RESOLVED', 'REJECTED']);
    const note = text(body.note, 'Admin resolution note', 1000);
    const dispute = await this.prisma.auditLog.findUnique({ where: { id } });
    if (!dispute || dispute.action !== 'BOOKING_DISPUTE') throw new NotFoundException('Dispute not found');
    let parsed: any = {};
    try { parsed = JSON.parse(dispute.detail || '{}'); } catch {}

    await this.prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        action: 'DISPUTE_RESPONSE',
        targetId: id,
        detail: JSON.stringify({ status, note }),
      },
    });

    await this.prisma.notification.create({
      data: {
        userId: dispute.actorId,
        bookingId: dispute.targetId || undefined,
        type: 'DISPUTE_UPDATE',
        title: `Dispute ${parsed.reference || id.slice(0, 8)} updated: ${status.replaceAll('_', ' ')}`,
        message: note,
      },
    });

    return { ok: true, status, note };
  }
}
