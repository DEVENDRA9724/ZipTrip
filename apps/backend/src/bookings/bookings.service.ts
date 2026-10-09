import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { text, number, choice, INSPECTION_KINDS } from '../common/validation';
import { rentalPeriod, overlappingReservations } from './availability';
import { rentalQuote } from './pricing';
import { rentalPolicy, cancellationRefundPercent } from './rental-policy';
import { agreementPolicySnapshot, carSharingAgreementTerms, CAR_SHARING_AGREEMENT_VERSION } from './car-sharing-agreement';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService, @Optional() private notifications?: NotificationsService) {}
  async create(customerId: string, data: any) {
    const vehicleId = text(data.vehicleId, 'Vehicle');
    const requestKey = customerId + ':' + text(data.requestKey, 'Request key', 80);
    const { start, end } = rentalPeriod(data.startDate, data.endDate);
    const booking = await this.prisma.$transaction(async tx => {
      const previous = await tx.booking.findUnique({ where: { requestKey }, include: { vehicle: true, payment: true, invoice: true } });
      if (previous) {
        if (previous.vehicleId !== vehicleId || +previous.startDate !== +start || +previous.endDate !== +end) throw new ConflictException('Request key already used for another booking');
        return previous;
      }
      const user = await tx.user.findUnique({ where: { id: customerId } });
      if (!user?.isVerified || !user.dlValidUntil || user.dlValidUntil < end) throw new ForbiddenException('Complete KYC and obtain DL approval valid through your return date');
      // Lock before reading the price and status so admin changes cannot create stale quotes.
      const locked = await tx.vehicle.updateMany({ where: { id: vehicleId }, data: { updatedAt: new Date() } });
      if (!locked.count) throw new NotFoundException('Car is not available');
      const car = await tx.vehicle.findUnique({ where: { id: vehicleId } });
      if (!car || car.status !== 'ACTIVE') throw new NotFoundException('Car is not available');
      if (car.hostId === customerId) throw new BadRequestException('You cannot book your own car');
      const docs = await tx.document.findMany({ where: { vehicleId, status: 'APPROVED', kind: { in: ['RC', 'INSURANCE', 'PUC'] }, validUntil: { gte: end } } });
      if (!['RC', 'INSURANCE', 'PUC'].every(k => docs.some(d => d.kind === k))) throw new BadRequestException('Vehicle documents must remain valid through your return date');
      // Serialize changes on this car before checking availability. Works with SQLite's write lock
      // and also becomes a row lock when migrated to PostgreSQL.
      await tx.vehicle.update({ where: { id: vehicleId }, data: { updatedAt: new Date() } });
      const conflict = await tx.booking.findFirst({ where: { vehicleId, ...overlappingReservations(start, end) } as any });
      if (conflict) throw new ConflictException('Car is already reserved for these dates');
      const blocked = await tx.availabilityBlock.findFirst({ where: { vehicleId, releasedAt: null, startDate: { lt: end }, endDate: { gt: start } } });
      if (blocked) throw new ConflictException('The host has blocked this car for the selected dates');
      const { rentalDays, totalAmount, includedKilometres, securityDeposit } = rentalQuote(car.pricePerDay, start, end);
      if (data.expectedTotal !== undefined && Number(data.expectedTotal) !== totalAmount) throw new ConflictException('The rental price changed. Refresh your quote before booking.');
      const policySnapshot = agreementPolicySnapshot({
        securityDeposit: rentalPolicy.deposit,
        includedKilometresPer24Hours: rentalPolicy.kilometresPer24Hours,
        excessKmRate: rentalPolicy.excessKmRate,
        lateGraceMinutes: rentalPolicy.lateGraceMinutes,
        lateReturnRatePerHour: rentalPolicy.lateRatePerHour,
        cancellation: rentalPolicy.cancellation,
      });
      const termsSnapshot = carSharingAgreementTerms(policySnapshot);
      return tx.booking.create({ data: { customerId, vehicleId, requestKey, startDate: start, endDate: end, rentalDays, dailyRate: car.pricePerDay, totalAmount, includedKilometres, securityDeposit,
        bookingRef: 'SF-' + randomUUID().toUpperCase(), status: 'PENDING', expiresAt: new Date(Math.min(Date.now() + 30 * 60000, +start)),
        agreementVersion: CAR_SHARING_AGREEMENT_VERSION, agreementSnapshot: JSON.stringify({ policy: policySnapshot, terms: termsSnapshot, createdAt: new Date().toISOString() }) },
        include: { vehicle: true, payment: true, invoice: true } });
    }, { timeout: 10000 });
    await this.notifyBooking(booking, 'BOOKING_CREATED', 'Booking request received', `Booking ${booking.bookingRef} is awaiting payment and host confirmation.`);
    return booking;
  }
  getMyTrips(customerId: string) {
    return this.prisma.booking.findMany({ where: { customerId }, include: { vehicle: true, payment: true, invoice: true, inspections: true }, orderBy: { createdAt: 'desc' }, take: 200 });
  }
  getHostBookings(hostId: string) {
    return this.prisma.booking.findMany({ where: { vehicle: { hostId } }, include: { vehicle: true, customer: { select: { firstName: true, lastName: true, phone: true } }, payment: true, inspections: true }, orderBy: { createdAt: 'desc' }, take: 200 });
  }
  async agreement(user: any, id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        vehicle: { include: { host: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } } },
        payment: true,
      inspections: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    const isParty = booking.customerId === user.id || booking.vehicle.hostId === user.id || user.role === 'ADMIN';
    if (!isParty) throw new ForbiddenException('Agreement access denied');
    let savedSnapshot: any = null;
    try { savedSnapshot = booking.agreementSnapshot ? JSON.parse(booking.agreementSnapshot) : null; } catch { savedSnapshot = null; }
    const policy = agreementPolicySnapshot(savedSnapshot?.policy || {
      securityDeposit: booking.securityDeposit,
      includedKilometresPer24Hours: booking.includedKilometres || rentalPolicy.kilometresPer24Hours,
      excessKmRate: rentalPolicy.excessKmRate,
      lateGraceMinutes: rentalPolicy.lateGraceMinutes,
      lateReturnRatePerHour: rentalPolicy.lateRatePerHour,
      cancellation: rentalPolicy.cancellation,
    });
    const agreementVersion = booking.agreementVersion || CAR_SHARING_AGREEMENT_VERSION;
    const acknowledgement = await this.prisma.auditLog.findFirst({ where: { action: 'BOOKING_AGREEMENT_ACKNOWLEDGED', targetId: id, actorId: user.id, detail: agreementVersion }, orderBy: { createdAt: 'desc' } });
    const business = {
      name: process.env.BUSINESS_NAME || 'Safar Self Drive',
      legalName: process.env.BUSINESS_LEGAL_NAME || process.env.BUSINESS_NAME || 'Safar Self Drive',
      address: process.env.BUSINESS_ADDRESS || '',
      phone: process.env.BUSINESS_PHONE || '',
      email: process.env.BUSINESS_EMAIL || '',
    };
    return {
      agreementVersion,
      generatedAt: new Date().toISOString(),
      business,
      electronicExecution: 'This electronic record is generated by the Platform. Click acknowledgement, OTP, or completion of the booking is electronic execution by the relevant Party.',
      platformRole: 'Safar is the intermediary and technology facilitator. The Vehicle lease is directly between the Host and the Guest, while Safar administers verification, booking, payment, inspection, settlement and dispute workflows.',
      booking: {
        id: booking.id,
        reference: booking.bookingRef,
        status: booking.status,
        createdAt: booking.createdAt,
        startDate: booking.startDate,
        endDate: booking.endDate,
        rentalDays: booking.rentalDays,
        dailyRate: Number(booking.dailyRate),
        rentalAmount: Math.max(0, Number(booking.totalAmount) - Number(booking.securityDeposit)),
        securityDeposit: Number(booking.securityDeposit),
        totalAmount: Number(booking.totalAmount),
        includedKilometres: booking.includedKilometres,
        excessKmRate: policy.excessKmRate,
        lateReturnGraceMinutes: policy.lateGraceMinutes,
        lateReturnRatePerHour: policy.lateReturnRatePerHour,
        paymentStatus: booking.payment?.status || 'NOT_RECORDED',
      },
      customer: booking.customer,
      host: booking.vehicle.host,
      vehicle: {
        id: booking.vehicle.id,
        make: booking.vehicle.make,
        model: booking.vehicle.model,
        year: booking.vehicle.year,
        registrationNumber: booking.vehicle.registrationNumber,
        category: booking.vehicle.category,
        transmission: booking.vehicle.transmission,
        fuelType: booking.vehicle.fuelType,
        seats: booking.vehicle.seats,
        locationCity: booking.vehicle.locationCity,
      },
      inspections: booking.inspections.map(item => ({ stage: item.stage, odometer: item.odometer, mediaIds: item.mediaIds ? JSON.parse(item.mediaIds) : [item.mediaId], fuelPercent: item.fuelPercent, damageNote: item.damageNote, createdAt: item.createdAt })),
      scheduleI: {
        effectiveDate: booking.startDate,
        bookingPeriod: { start: booking.startDate, end: booking.endDate },
        designatedLocation: booking.vehicle.locationCity,
        primaryGuest: booking.customer,
        host: booking.vehicle.host,
        vehicle: { ...booking.vehicle, images: undefined },
        trip: { pickupLocation: booking.vehicle.locationCity, returnLocation: booking.vehicle.locationCity, rentalDays: booking.rentalDays, bookingStatus: booking.status },
      },
      scheduleIII: {
        bookingFee: Math.max(0, Number(booking.totalAmount) - Number(booking.securityDeposit)),
        securityDeposit: Number(booking.securityDeposit),
        includedKilometres: booking.includedKilometres,
        excessKmRate: policy.excessKmRate,
        lateGraceMinutes: policy.lateGraceMinutes,
        lateReturnRatePerHour: policy.lateReturnRatePerHour,
        depositReleaseTarget: 'Within 7 working days after clean check-out; a documented pending challan, toll or damage review may delay the related amount.',
      },
      scheduleIV: { ...policy.cancellation, refundTiming: 'Eligible refunds are reviewed and returned to the original payment method according to Safar reconciliation timelines.' },
      terms: Array.isArray(savedSnapshot?.terms) ? savedSnapshot.terms : carSharingAgreementTerms(policy),
      cancellationRefundPercent: cancellationRefundPercent(booking.startDate),
      acknowledgement: acknowledgement ? { acceptedAt: acknowledgement.createdAt, version: acknowledgement.detail } : null,
    };
  }
  async acknowledgeAgreement(user: any, id: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id }, include: { vehicle: true } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.customerId !== user.id && booking.vehicle.hostId !== user.id && user.role !== 'ADMIN') throw new ForbiddenException('Agreement access denied');
    const detail = CAR_SHARING_AGREEMENT_VERSION;
    const row = await this.prisma.auditLog.create({ data: { actorId: user.id, action: 'BOOKING_AGREEMENT_ACKNOWLEDGED', targetId: id, detail } });
    return { acceptedAt: row.createdAt, version: detail };
  }
  async agreementPdf(user: any, id: string) {
    const agreement = await this.agreement(user, id);
    const root = process.cwd();
    const template = [
      resolve(root, 'templates/Safarcars_Car_Sharing_Agreement.docx'),
      resolve(root, 'apps/backend/templates/Safarcars_Car_Sharing_Agreement.docx'),
    ].find(path => require('node:fs').existsSync(path));
    const script = [
      resolve(root, 'scripts/populate_agreement.py'),
      resolve(root, 'apps/backend/scripts/populate_agreement.py'),
    ].find(path => require('node:fs').existsSync(path));
    const fallbackPdfScript = [
      resolve(root, 'scripts/docx_to_pdf_reportlab.py'),
      resolve(root, 'apps/backend/scripts/docx_to_pdf_reportlab.py'),
    ].find(path => require('node:fs').existsSync(path));
    if (!template || !script) throw new BadRequestException('Agreement PDF template is not installed');
    const work = await fs.mkdtemp(join(tmpdir(), 'safar-agreement-'));
    const dataPath = join(work, 'agreement.json');
    const docxPath = join(work, 'agreement.docx');
    await fs.writeFile(dataPath, JSON.stringify({
      ...agreement,
      trip: agreement.scheduleI?.trip,
      policy: agreement.scheduleIII,
    }), 'utf8');
    const python = process.env.AGREEMENT_PYTHON || 'python';
    await this.runProcess(python, [script, '--template', template, '--data', dataPath, '--output', docxPath], work);
    const pdfPath = join(work, 'agreement.pdf');
    try {
      const renderer = process.env.AGREEMENT_DOCX_RENDERER;
      if (renderer) {
        await this.runProcess(python, [renderer, docxPath, '--output_dir', work, '--emit_pdf'], work);
      } else {
        const soffice = process.env.AGREEMENT_SOFFICE || 'soffice';
        await this.runProcess(soffice, ['--headless', '--convert-to', 'pdf', '--outdir', work, docxPath], work);
      }
    } catch (error) {
      if (!fallbackPdfScript) throw error;
      await this.runProcess(python, [fallbackPdfScript, '--input', docxPath, '--output', pdfPath], work);
    }
    if (!require('node:fs').existsSync(pdfPath)) throw new BadRequestException('Agreement PDF conversion failed');
    const buffer = await fs.readFile(pdfPath);
    await fs.rm(work, { recursive: true, force: true });
    return { buffer, fileName: `${agreement.booking.reference || id}-safarcars-agreement.pdf` };
  }
  private runProcess(command: string, args: string[], cwd: string) {
    return new Promise<void>((resolveProcess, reject) => {
      let child;
      try {
        child = spawn(command, args, { cwd, windowsHide: true });
      } catch (error: any) {
        reject(new BadRequestException(`Agreement document converter is unavailable: ${error?.message || 'process could not start'}`));
        return;
      }
      let stderr = '';
      child.stderr.on('data', chunk => { stderr += String(chunk); });
      child.on('error', error => reject(new BadRequestException(`Agreement document converter is unavailable: ${error.message}`)));
      child.on('close', code => code === 0 ? resolveProcess() : reject(new BadRequestException(`Agreement document conversion failed${stderr ? `: ${stderr.slice(0, 300)}` : ''}`)));
    });
  }
  async cancel(userId: string, id: string) {
    return this.prisma.$transaction(async tx => {
      const booking = await tx.booking.findUnique({ where: { id }, include: { vehicle: true } });
      if (!booking) throw new NotFoundException('Booking not found');
      if (booking.customerId !== userId && booking.vehicle.hostId !== userId) throw new ForbiddenException('Booking access denied');
      if (!['PENDING', 'CONFIRMED'].includes(booking.status) || booking.startDate <= new Date()) throw new BadRequestException('Cancellation is only available before pickup');
      const changed = await tx.booking.updateMany({ where: { id, status: booking.status }, data: { status: 'CANCELLED' } });
      if (changed.count !== 1) throw new ConflictException('Booking changed; refresh and retry');
      await tx.payment.updateMany({ where: { bookingId: id, status: 'SUCCESS' }, data: { status: 'REFUND_PENDING' } });
      await tx.invoice.updateMany({ where: { bookingId: id }, data: { status: 'REFUND_PENDING' } });
      await tx.auditLog.create({ data: { actorId: userId, action: 'BOOKING_CANCELLED', targetId: id, detail: 'External refunds require administrator reconciliation' } });
      return { id, status: 'CANCELLED' };
    });
  }
  async inspect(user: any, id: string, body: any) {
    const stage = choice(body.stage, 'Inspection stage', ['PICKUP', 'RETURN', 'DAMAGE']);
    const odometer = number(body.odometer ?? 0, 'Odometer', 0, 2000000, true);
    const mediaId = text(body.mediaId, stage === 'DAMAGE' ? 'Damage photo' : 'Odometer photo');
    const fuelPercent = number(body.fuelPercent, 'Fuel level (%)', 0, 100, true);
    const damageNote = text(body.damageNote, 'Vehicle condition', 2000);
    const mediaIds = Array.from(new Set([mediaId, ...(Array.isArray(body.mediaIds) ? body.mediaIds : [])].map(item => text(item, 'Inspection photo', 100))));
    if (mediaIds.length > 12) throw new BadRequestException('Upload up to 12 inspection photos');
    const booking = await this.prisma.$transaction(async tx => {
      const booking = await tx.booking.findUnique({ where: { id }, include: { vehicle: true, inspections: true } });
      if (!booking) throw new NotFoundException('Booking not found');
      const isHost = booking.vehicle.hostId === user.id || user.role === 'ADMIN';
      const isCustomer = booking.customerId === user.id;
      if (stage === 'DAMAGE' ? !isCustomer && !isHost : !isHost) throw new ForbiddenException(stage === 'DAMAGE' ? 'Booking customer, host or administrator required' : 'Host or administrator required');
      if (stage === 'PICKUP' && (booking.status !== 'CONFIRMED' || booking.startDate > new Date() || booking.endDate <= new Date())) throw new BadRequestException('Pickup is available during the confirmed rental period');
      if (stage === 'RETURN' && booking.status !== 'ACTIVE') throw new BadRequestException('Only active trips can be returned');
      if (stage === 'DAMAGE' && booking.status !== 'ACTIVE') throw new BadRequestException('Damage reports are available during an active trip');
      const minimum = stage === 'RETURN' ? booking.inspections.find(i => i.stage === 'PICKUP')?.odometer : booking.vehicle.odometer;
      if (stage !== 'DAMAGE' && (minimum === undefined || odometer < minimum)) throw new BadRequestException('Odometer cannot decrease');
      const media = await tx.media.findMany({ where: { id: { in: mediaIds }, ownerId: user.id, vehicleId: null, kind: { in: [...INSPECTION_KINDS] } } });
      if (media.length !== mediaIds.length || (stage !== 'DAMAGE' && !media.some(item => item.id === mediaId && item.kind === 'ODOMETER'))) throw new BadRequestException('Upload the required inspection photo and ensure every inspection photo belongs to you');
      if (stage === 'PICKUP' && !media.some(item => item.kind === 'SELFIE_PICKUP')) throw new BadRequestException('Upload a pickup selfie');
      if (stage === 'RETURN' && !media.some(item => item.kind === 'SELFIE_RETURN')) throw new BadRequestException('Upload a return selfie');
      if (stage === 'PICKUP' && !media.some(item => item.kind === 'INSPECTION_PICKUP')) throw new BadRequestException('Upload at least one pickup condition photo');
      if (stage === 'RETURN' && !media.some(item => item.kind === 'INSPECTION_RETURN')) throw new BadRequestException('Upload at least one return condition photo');
      const alreadyUsed = await tx.inspection.findFirst({ where: { mediaId: { in: mediaIds } } });
      if (alreadyUsed) throw new BadRequestException('One of these inspection photos was already used');
      if (stage === 'DAMAGE') {
        if (!media.some(item => item.kind === 'DAMAGE')) throw new BadRequestException('Upload at least one damage photo');
        await tx.inspection.create({ data: { bookingId: id, stage, odometer, mediaId, mediaIds: JSON.stringify(mediaIds), fuelPercent, damageNote, note: body.note ? text(body.note, 'Inspection note', 1000) : null } });
        await tx.auditLog.create({ data: { actorId: user.id, action: 'DAMAGE_REPORTED', targetId: id, detail: 'Odometer ' + odometer } });
        return { message: 'Damage report submitted' };
      }
      const updated = await tx.booking.updateMany({ where: { id, status: booking.status }, data: { status: stage === 'PICKUP' ? 'ACTIVE' : 'COMPLETED' } });
      if (updated.count !== 1) throw new ConflictException('Trip changed');
      await tx.inspection.create({ data: { bookingId: id, stage, odometer, mediaId, mediaIds: JSON.stringify(mediaIds), fuelPercent, damageNote, note: body.note ? text(body.note, 'Inspection note', 1000) : null } });
      await tx.vehicle.update({ where: { id: booking.vehicleId }, data: { odometer } });
      await tx.auditLog.create({ data: { actorId: user.id, action: stage, targetId: id, detail: 'Odometer ' + odometer } });
      return { message: stage === 'PICKUP' ? 'Trip started' : 'Trip completed' };
    });
  }

  private async notifyBooking(booking: any, type: string, title: string, message: string) {
    if (!this.notifications || !booking?.vehicle) return;
    await Promise.allSettled([
      this.notifications.create(booking.customerId, { type, title, message, bookingId: booking.id }),
      this.notifications.create(booking.vehicle.hostId, { type, title, message, bookingId: booking.id }),
    ]);
  }
}
