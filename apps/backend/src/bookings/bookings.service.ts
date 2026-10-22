import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException, Optional, ServiceUnavailableException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { text, number, choice, PHOTO_KINDS, INSPECTION_KINDS } from '../common/validation';
import { rentalPeriod, overlappingReservations } from './availability';
import { rentalQuote } from './pricing';
import { rentalPolicy, cancellationRefundPercent } from './rental-policy';
import { agreementPolicySnapshot, carSharingAgreementTerms, CAR_SHARING_AGREEMENT_VERSION } from './car-sharing-agreement';
import { NotificationsService } from '../notifications/notifications.service';
import {
  vehicleEligibility,
  eligibilityMessage,
} from '../vehicles/vehicle-status';

// Each PDF spawns python and LibreOffice; cap concurrent jobs per instance and kill converters that hang.
const AGREEMENT_PDF_CONCURRENCY = 2;
const agreementProcessTimeout = () => Number(process.env.AGREEMENT_PROCESS_TIMEOUT_MS) > 0 ? Number(process.env.AGREEMENT_PROCESS_TIMEOUT_MS) : 60000;
import { assertBookingTransition } from '../rental-domain/rental-state';
import { calculateSettlement } from '../rental-domain/settlement';
import { isLocalDevelopment } from '../common/environment';


@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);
  private pdfJobs = 0;
  constructor(private prisma: PrismaService, @Optional() private notifications?: NotificationsService) {}

  async create(customerId: string, data: any) {
    const vehicleId = text(data.vehicleId, 'Vehicle');
    const requestKey = customerId + ':' + text(data.requestKey, 'Request key', 80);
    const { start, end } = rentalPeriod(data.startDate, data.endDate);
    let created = false;
    const booking = await this.prisma.$transaction(async tx => {
      const previous = await tx.booking.findUnique({
        where: { requestKey },
        include: { vehicle: true, payment: true, invoice: true, trip: true },
      });
      if (previous) {
        if (previous.vehicleId !== vehicleId || +previous.startDate !== +start || +previous.endDate !== +end) {
          throw new ConflictException('Request key already used for another booking');
        }
        return previous;
      }
      const user = await tx.user.findUnique({ where: { id: customerId } });
      if (!user?.isVerified || !user.dlValidUntil || user.dlValidUntil < end) {
        throw new ForbiddenException('Complete e-KYC & Driving Licence verification valid through your return date before booking.');
      }
      const locked = await tx.vehicle.updateMany({ where: { id: vehicleId }, data: { updatedAt: new Date() } });
      if (!locked.count) throw new NotFoundException('Car is not available');
      const car = await tx.vehicle.findUnique({ where: { id: vehicleId }, include: { documents: true } });
      if (!car || car.approvalStatus !== 'APPROVED' || car.availability !== 'ACTIVE') throw new NotFoundException('Car is not available');
      if (car.hostId === customerId) throw new BadRequestException('You cannot book your own car');
      const eligibility = vehicleEligibility(car, end);
      if (!eligibility.bookable) throw new BadRequestException(eligibilityMessage(eligibility.reasons));
      // Serialize changes on this car before checking availability. Works with SQLite's write lock
      // and also becomes a row lock when migrated to PostgreSQL.
      await tx.vehicle.update({ where: { id: vehicleId }, data: { updatedAt: new Date() } });
      const conflict = await tx.booking.findFirst({ where: { vehicleId, ...overlappingReservations(start, end) } as any });
      if (conflict) throw new ConflictException('Car is already reserved for these dates');
      const blocked = await tx.availabilityBlock.findFirst({
        where: { vehicleId, releasedAt: null, startDate: { lt: end }, endDate: { gt: start } },
      });
      if (blocked) throw new ConflictException('The host has blocked this car for the selected dates');
      const { rentalDays, totalAmount, includedKilometres, securityDeposit } = rentalQuote(car.pricePerDay, start, end);
      if (data.expectedTotal !== undefined && Number(data.expectedTotal) !== totalAmount) {
        throw new ConflictException('The rental price changed. Refresh your quote before booking.');
      }

      const tenureHours = Math.max(1, Math.ceil((+end - +start) / 3600000));
      const baseFare = Math.max(0, Number(totalAmount) - Number(securityDeposit));
      const platformFee = Math.round(baseFare * rentalPolicy.platformCommissionRate);
      const hostRevenue = Math.max(0, baseFare - platformFee);

      const policySnapshot = agreementPolicySnapshot({
        securityDeposit: rentalPolicy.deposit,
        includedKilometresPer24Hours: rentalPolicy.kilometresPer24Hours,
        excessKmRate: rentalPolicy.excessKmRate,
        lateGraceMinutes: rentalPolicy.lateGraceMinutes,
        lateReturnRatePerHour: rentalPolicy.lateRatePerHour,
        cancellation: rentalPolicy.cancellation,
      });
      const termsSnapshot = carSharingAgreementTerms(policySnapshot);
      const reservation = await tx.booking.create({
        data: {
          customerId,
          vehicleId,
          pickupHubId: car.currentHubId,
          dropoffHubId: car.currentHubId,
          requestKey,
          startDate: start,
          endDate: end,
          tenureHours,
          rentalDays,
          dailyRate: car.pricePerDay,
          baseFare,
          platformFee,
          hostRevenue,
          totalAmount,
          includedKilometres,
          securityDeposit,
          bookingRef: 'SF-' + randomUUID().toUpperCase(),
          status: 'PENDING',
          expiresAt: new Date(Math.min(Date.now() + 30 * 60000, +start)),
          agreementVersion: CAR_SHARING_AGREEMENT_VERSION,
          agreementSnapshot: JSON.stringify({ policy: policySnapshot, terms: termsSnapshot, createdAt: new Date().toISOString() }),
          trip: {
            create: {
              startOdometer: car.odometer,
              startFuelLevel: car.fuelLevelPercent || 100,
              tripStatus: 'not_started',
            },
          },
        },
        include: { vehicle: true, payment: true, invoice: true, trip: true },
      });
      created = true;
      return reservation;
    }, { timeout: 10000 });
    // Idempotent replays return the original booking without notifying the parties again.
    if (created) await this.notifyBooking(booking, 'BOOKING_CREATED', 'Booking request received', `Booking ${booking.bookingRef} is awaiting payment confirmation.`);
    return booking;
  }

  // Simulated payment for local development only: a real deployment confirms bookings through the signed gateway webhook.
  async pay(customerId: string, id: string, body: any) {
    if (!isLocalDevelopment()) throw new ForbiddenException('Pay through the secure checkout. Direct confirmation is only available in local development.');
    const method = body?.method ? String(body.method).toUpperCase() : 'UPI';
    const gatewayProvider = body?.gatewayProvider ? String(body.gatewayProvider) : 'Razorpay';

    const updatedBooking = await this.prisma.$transaction(async tx => {
      const booking = await tx.booking.findUnique({
        where: { id },
        include: { vehicle: true, payment: true, invoice: true, customer: true },
      });
      if (!booking) throw new NotFoundException('Booking not found');
      if (booking.customerId !== customerId) throw new ForbiddenException('You can only pay for your own booking');
      if (booking.status === 'CONFIRMED' || booking.status === 'ACTIVE') return booking;
      if (booking.status !== 'PENDING') throw new BadRequestException('Only pending bookings can be paid');
      try {
        assertBookingTransition(booking.status, 'CONFIRMED');
      } catch (error: any) {
        throw new BadRequestException(error.message);
      }
      if (booking.expiresAt && booking.expiresAt < new Date()) {
        throw new BadRequestException('This booking hold has expired. Please create a new booking.');
      }

      const txId = body?.reference
        ? String(body.reference).trim().slice(0, 80)
        : `PAY-${method}-${Date.now().toString(36).toUpperCase()}`;
      const invNo = `INV-${new Date().getFullYear()}-${randomUUID().slice(0, 6).toUpperCase()}`;

      await tx.booking.update({
        where: { id },
        data: {
          status: 'CONFIRMED',
          agreementAcceptedAt: new Date(),
        },
      });

      if (!booking.payment) {
        await tx.payment.create({
          data: {
            bookingId: id,
            transactionId: txId,
            gatewayProvider,
            paymentType: 'booking_fare',
            amount: booking.totalAmount,
            currency: 'INR',
            status: 'SUCCESS',
          },
        });
      } else {
        await tx.payment.update({
          where: { bookingId: id },
          data: { status: 'SUCCESS', transactionId: txId, gatewayProvider },
        });
      }

      if (!booking.invoice) {
        await tx.invoice.create({
          data: {
            bookingId: id,
            number: invNo,
            amount: booking.totalAmount,
            currency: 'INR',
            status: 'PAID',
            snapshot: JSON.stringify({
              invoiceNumber: invNo,
              bookingRef: booking.bookingRef,
              customerName: `${booking.customer.firstName} ${booking.customer.lastName}`,
              vehicle: `${booking.vehicle.make} ${booking.vehicle.model} (${booking.vehicle.registrationNumber || ''})`,
              baseFare: Number(booking.baseFare),
              securityDeposit: Number(booking.securityDeposit),
              platformFee: Number(booking.platformFee),
              hostRevenue: Number(booking.hostRevenue),
              totalAmount: Number(booking.totalAmount),
              paymentMethod: method,
              paidAt: new Date().toISOString(),
            }),
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: customerId,
          action: 'BOOKING_PAID_CONFIRMED',
          targetId: id,
          detail: `${txId} (${method}) · Total ₹${booking.totalAmount} · Host Share ₹${booking.hostRevenue} · Platform Fee ₹${booking.platformFee}`,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: customerId,
          action: 'BOOKING_AGREEMENT_ACKNOWLEDGED',
          targetId: id,
          detail: booking.agreementVersion || CAR_SHARING_AGREEMENT_VERSION,
        },
      });

      return tx.booking.findUnique({
        where: { id },
        include: { vehicle: true, payment: true, invoice: true, trip: true, inspections: true },
      });
    });

    if (updatedBooking) {
      await this.notifyBooking(
        updatedBooking,
        'BOOKING_CONFIRMED',
        'Payment confirmed & e-Agreement generated',
        `Booking ${updatedBooking.bookingRef} is confirmed! Your Car Lease e-Agreement is ready. Complete the 8-photo + selfie handover at the hub to start your trip.`,
      );
    }
    return updatedBooking;
  }

  getMyTrips(customerId: string) {
    return this.prisma.booking.findMany({
      where: { customerId },
      include: {
        vehicle: {
          include: {
            host: { select: { id: true, firstName: true, lastName: true, phone: true } },
            currentHub: true,
          },
        },
        payment: true,
        invoice: true,
        trip: true,
        inspections: true,
        settlement: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  getHostBookings(hostId: string) {
    return this.prisma.booking.findMany({
      where: { vehicle: { hostId } },
      include: {
        vehicle: { include: { currentHub: true } },
        customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, isVerified: true, profileImage: true, profile: true } },
        payment: true,
        invoice: true,
        trip: true,
        inspections: true,
        settlement: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async agreement(user: any, id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, profile: true } },
        vehicle: { include: { host: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } }, currentHub: true } },
        payment: true,
        trip: true,
        inspections: { orderBy: { createdAt: 'asc' } },
        settlement: true,
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
    const acknowledgement = await this.prisma.auditLog.findFirst({
      where: { action: 'BOOKING_AGREEMENT_ACKNOWLEDGED', targetId: id, detail: agreementVersion },
      orderBy: { createdAt: 'desc' },
    });
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
        tenureHours: booking.tenureHours,
        rentalDays: booking.rentalDays,
        dailyRate: Number(booking.dailyRate),
        rentalAmount: Math.max(0, Number(booking.totalAmount) - Number(booking.securityDeposit)),
        baseFare: Number(booking.baseFare),
        platformFee: Number(booking.platformFee),
        hostRevenue: Number(booking.hostRevenue),
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
        vinNumber: booking.vehicle.vinNumber,
        category: booking.vehicle.category,
        transmission: booking.vehicle.transmission,
        fuelType: booking.vehicle.fuelType,
        seats: booking.vehicle.seats,
        locationCity: booking.vehicle.locationCity,
      },
      inspections: booking.inspections.map(item => ({
        stage: item.stage,
        odometer: item.odometer,
        mediaIds: item.mediaIds ? JSON.parse(item.mediaIds) : [item.mediaId],
        selfieMediaId: item.selfieMediaId,
        fuelPercent: item.fuelPercent,
        damageNote: item.damageNote,
        createdAt: item.createdAt,
      })),
      scheduleI: {
        effectiveDate: booking.startDate,
        bookingPeriod: { start: booking.startDate, end: booking.endDate },
        designatedLocation: booking.vehicle.locationCity,
        primaryGuest: booking.customer,
        host: booking.vehicle.host,
        vehicle: { ...booking.vehicle, images: undefined },
        trip: {
          pickupLocation: booking.vehicle.pickupAddress || booking.vehicle.locationCity,
          returnLocation: booking.vehicle.dropAddress || booking.vehicle.locationCity,
          rentalDays: booking.rentalDays,
          bookingStatus: booking.status,
        },
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
      scheduleIV: {
        ...policy.cancellation,
        refundTiming: 'Eligible refunds are reviewed and returned to the original payment method according to Safar reconciliation timelines.',
      },
      settlement: booking.settlement ? {
        status: booking.settlement.status,
        automaticCharges: Number(booking.settlement.automaticCharges),
        damageCharges: Number(booking.settlement.damageCharges),
        fuelCharges: Number(booking.settlement.fuelCharges),
        tollCharges: Number(booking.settlement.tollCharges),
        fineCharges: Number(booking.settlement.fineCharges),
        cleaningCharges: Number(booking.settlement.cleaningCharges),
        otherCharges: Number(booking.settlement.otherCharges),
        totalDeduction: Number(booking.settlement.totalDeduction),
        refundAmount: Number(booking.settlement.refundAmount),
        additionalAmountDue: Number(booking.settlement.additionalAmountDue),
        note: booking.settlement.note,
        settledAt: booking.settlement.updatedAt,
      } : null,
      terms: Array.isArray(savedSnapshot?.terms) ? savedSnapshot.terms : carSharingAgreementTerms(policy),
      cancellationRefundPercent: cancellationRefundPercent(booking.startDate),
      acknowledgement: acknowledgement ? { acceptedAt: acknowledgement.createdAt, version: acknowledgement.detail } : null,
    };
  }

  async acknowledgeAgreement(user: any, id: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id }, include: { vehicle: true } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.customerId !== user.id && booking.vehicle.hostId !== user.id && user.role !== 'ADMIN') throw new ForbiddenException('Agreement access denied');
    // Acknowledge the version snapshotted on this booking (the one agreement() displays and looks up), not the current default.
    const detail = booking.agreementVersion || CAR_SHARING_AGREEMENT_VERSION;
    await this.prisma.booking.update({ where: { id }, data: { agreementAcceptedAt: new Date() } });
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
    if (this.pdfJobs >= AGREEMENT_PDF_CONCURRENCY) throw new ServiceUnavailableException('Agreement PDFs are being generated for other requests. Try again in a minute.');
    this.pdfJobs++;
    // The work folder holds party names, emails and phone numbers, so it is removed on every exit path.
    const work = await fs.mkdtemp(join(tmpdir(), 'safar-agreement-')).catch(error => { this.pdfJobs--; throw error; });
    try {
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
      return { buffer, fileName: `${agreement.booking.reference || id}-safarcars-agreement.pdf` };
    } finally {
      this.pdfJobs--;
      await fs.rm(work, { recursive: true, force: true }).catch(error => this.logger.warn(`Agreement work folder cleanup failed: ${error?.message}`));
    }
  }
  private runProcess(command: string, args: string[], cwd: string, timeoutMs = agreementProcessTimeout()) {
    return new Promise<void>((resolveProcess, reject) => {
      // Converter output can contain server paths; it is logged here and clients receive a generic message.
      // Only the last line (typically the exception) is kept, with the work folder redacted: tracebacks can echo
      // agreement data such as party names, and the folder path is not useful in logs.
      const fail = (detail: string) => { const line = detail.trim().split(/\r?\n/).pop() || ''; this.logger.warn(`Agreement converter ${command.split(/[\\/]/).pop()} failed: ${line.split(cwd).join('<work>').slice(0, 300)}`); reject(new BadRequestException('Agreement document conversion failed. Try again later or contact support.')); };
      let child;
      try {
        child = spawn(command, args, { cwd, windowsHide: true });
      } catch (error: any) {
        fail(error?.message || 'process could not start');
        return;
      }
      let stderr = '', settled = false;
      const timer = setTimeout(() => { if (settled) return; settled = true; child.kill('SIGKILL'); fail(`timed out after ${timeoutMs} ms`); }, timeoutMs);
      child.stderr.on('data', chunk => { if (stderr.length < 4000) stderr += String(chunk); });
      child.on('error', error => { if (settled) return; settled = true; clearTimeout(timer); fail(error.message); });
      child.on('close', code => { if (settled) return; settled = true; clearTimeout(timer); if (code === 0) resolveProcess(); else fail(`exit ${code}: ${stderr}`); });
    });
  }

  async cancel(userId: string, id: string) {
    const result = await this.prisma.$transaction(async tx => {
      const booking = await tx.booking.findUnique({ where: { id }, include: { vehicle: true } });
      if (!booking) throw new NotFoundException('Booking not found');
      if (booking.customerId !== userId && booking.vehicle.hostId !== userId) throw new ForbiddenException('Booking access denied');
      if (!['PENDING', 'CONFIRMED'].includes(booking.status) || booking.startDate <= new Date()) {
        throw new BadRequestException('Cancellation is only available before pickup');
      }
      try {
        assertBookingTransition(booking.status, 'CANCELLED');
      } catch (error: any) {
        throw new BadRequestException(error.message);
      }
      const changed = await tx.booking.updateMany({ where: { id, status: booking.status }, data: { status: 'CANCELLED' } });
      if (changed.count !== 1) throw new ConflictException('Booking changed; refresh and retry');
      await tx.payment.updateMany({ where: { bookingId: id, status: 'SUCCESS' }, data: { status: 'REFUND_PENDING' } });
      await tx.invoice.updateMany({ where: { bookingId: id }, data: { status: 'REFUND_PENDING' } });
      await tx.auditLog.create({
        data: { actorId: userId, action: 'BOOKING_CANCELLED', targetId: id, detail: 'External refunds require administrator reconciliation' },
      });
      return { id, status: 'CANCELLED' };
    });
    const booking = await this.prisma.booking.findUnique({ where: { id }, include: { vehicle: true } });
    if (booking) {
      await this.notifyBooking(booking, 'BOOKING_CANCELLED', 'Booking cancelled', `Booking ${booking.bookingRef} was cancelled. Any eligible refund is pending reconciliation.`);
    }
    return result;
  }

  async inspect(user: any, id: string, body: any) {
    const stage = choice(body.stage, 'Inspection stage', ['PICKUP', 'RETURN', 'DAMAGE']);
    const odometer = number(body.odometer ?? 0, 'Odometer', 0, 2000000, true);
    const mediaId = text(body.mediaId, stage === 'DAMAGE' ? 'Damage photo' : 'Odometer / primary photo');
    const selfieMediaId = body.selfieMediaId ? text(body.selfieMediaId, 'Customer handover selfie', 100) : null;
    const fuelPercent = number(body.fuelPercent ?? 100, 'Fuel level (%)', 0, 100, true);
    const damageNote = text(body.damageNote || 'Clean — all 8 angles & selfie verified at hub', 'Vehicle condition', 2000);
    const rawIds = [
      mediaId,
      ...(selfieMediaId ? [selfieMediaId] : []),
      ...(Array.isArray(body.mediaIds) ? body.mediaIds : []),
    ];
    const mediaIds = Array.from(new Set(rawIds.map(item => text(item, 'Inspection photo', 100))));
    if (mediaIds.length > 15) throw new BadRequestException('Upload up to 15 handover photos');

    const result = await this.prisma.$transaction(async tx => {
      const booking = await tx.booking.findUnique({
        where: { id },
        include: { vehicle: true, inspections: true, trip: true },
      });
      if (!booking) throw new NotFoundException('Booking not found');
      const isHost = booking.vehicle.hostId === user.id || user.role === 'ADMIN';
      const isCustomer = booking.customerId === user.id;
      if (!isCustomer && !isHost) throw new ForbiddenException('Booking customer, host or administrator required');
      if (stage === 'PICKUP' && booking.status !== 'CONFIRMED') {
        throw new BadRequestException('Only confirmed (paid) bookings can start trip pickup handover');
      }
      if (stage === 'PICKUP' && (booking.startDate > new Date() || booking.endDate <= new Date())) {
        throw new BadRequestException('Pickup is available during the confirmed rental period');
      }
      if (stage === 'RETURN' && booking.status !== 'ACTIVE') {
        throw new BadRequestException('Only active trips can complete return handover');
      }
      if (stage === 'DAMAGE' && booking.status !== 'ACTIVE') {
        throw new BadRequestException('Damage reports are available during an active trip');
      }
      if (stage !== 'DAMAGE') {
        try {
          assertBookingTransition(booking.status, stage === 'PICKUP' ? 'ACTIVE' : 'COMPLETED');
        } catch (error: any) {
          throw new BadRequestException(error.message);
        }
      }

      const pickupInspection = booking.inspections.find(i => i.stage === 'PICKUP');
      const minimum = stage === 'RETURN'
        ? (pickupInspection?.odometer ?? booking.trip?.startOdometer ?? booking.vehicle.odometer)
        : booking.vehicle.odometer;
      if (stage !== 'DAMAGE' && minimum !== undefined && odometer < minimum) {
        throw new BadRequestException(`Odometer cannot be less than ${minimum} km`);
      }

      const allowedKinds = [...PHOTO_KINDS, ...INSPECTION_KINDS];
      // Only photos the submitter uploaded for this handover (not attached to a car or another record) are accepted.
      const media = await tx.media.findMany({
        where: { id: { in: mediaIds }, ownerId: user.id, vehicleId: null, kind: { in: allowedKinds } },
      });
      if (!media.length || media.length !== mediaIds.length) {
        throw new BadRequestException('Upload the required 8 vehicle angle photos and customer selfie, and ensure every photo is your own upload');
      }
      // A photo may back only one inspection: check the primary column and the JSON list (ids are stored quoted, so the match is exact).
      const alreadyUsed = await tx.inspection.findFirst({ where: { OR: [{ mediaId: { in: mediaIds } }, ...mediaIds.map(item => ({ mediaIds: { contains: JSON.stringify(item) } }))] } });
      if (alreadyUsed) throw new BadRequestException('One of these inspection photos was already used');

      const isSelfie = (m: { kind: string }) => m.kind === 'SELFIE_PICKUP' || m.kind === 'SELFIE_RETURN';
      const resolvedSelfie =
        (selfieMediaId && media.some(m => m.id === selfieMediaId && isSelfie(m)) ? selfieMediaId : null) ||
        media.find(isSelfie)?.id ||
        null;

      if (stage !== 'DAMAGE' && !resolvedSelfie) {
        throw new BadRequestException('Customer handover selfie is mandatory to start or end a trip');
      }

      if (stage === 'DAMAGE') {
        await tx.inspection.upsert({
          where: { bookingId_stage: { bookingId: id, stage: 'DAMAGE' } },
          update: {
            odometer,
            mediaId,
            mediaIds: JSON.stringify(mediaIds),
            fuelPercent,
            damageNote,
            note: body.note ? text(body.note, 'Inspection note', 1000) : null,
          },
          create: {
            bookingId: id,
            stage,
            odometer,
            mediaId,
            mediaIds: JSON.stringify(mediaIds),
            fuelPercent,
            damageNote,
            note: body.note ? text(body.note, 'Inspection note', 1000) : null,
          },
        });
        await tx.auditLog.create({
          data: { actorId: user.id, action: 'DAMAGE_REPORTED', targetId: id, detail: 'Odometer ' + odometer },
        });
        return { message: 'Damage report submitted' };
      }

      const updated = await tx.booking.updateMany({
        where: { id, status: booking.status },
        data: { status: stage === 'PICKUP' ? 'ACTIVE' : 'COMPLETED' },
      });
      if (updated.count !== 1) throw new ConflictException('Trip status already changed');

      await tx.inspection.upsert({
        where: { bookingId_stage: { bookingId: id, stage } },
        update: {
          odometer,
          mediaId,
          mediaIds: JSON.stringify(mediaIds),
          selfieMediaId: resolvedSelfie,
          fuelPercent,
          damageNote,
          note: body.note ? text(body.note, 'Inspection note', 1000) : null,
        },
        create: {
          bookingId: id,
          stage,
          odometer,
          mediaId,
          mediaIds: JSON.stringify(mediaIds),
          selfieMediaId: resolvedSelfie,
          fuelPercent,
          damageNote,
          note: body.note ? text(body.note, 'Inspection note', 1000) : null,
        },
      });

      const imageUrlsJson = JSON.stringify(mediaIds.map(mid => `/api/media/${mid}`));
      const selfieUrl = resolvedSelfie ? `/api/media/${resolvedSelfie}` : null;

      if (stage === 'PICKUP') {
        await tx.trip.upsert({
          where: { bookingId: id },
          update: {
            actualStartTime: new Date(),
            startOdometer: odometer,
            startFuelLevel: fuelPercent,
            startChecklistImages: imageUrlsJson,
            startSelfieUrl: selfieUrl,
            tripStatus: 'ongoing',
          },
          create: {
            bookingId: id,
            actualStartTime: new Date(),
            startOdometer: odometer,
            startFuelLevel: fuelPercent,
            startChecklistImages: imageUrlsJson,
            startSelfieUrl: selfieUrl,
            tripStatus: 'ongoing',
          },
        });
      } else if (stage === 'RETURN') {
        const startOdo = pickupInspection?.odometer ?? booking.trip?.startOdometer ?? booking.vehicle.odometer;
        const travelledKm = Math.max(0, odometer - startOdo);
        const includedKm = booking.includedKilometres || (booking.rentalDays * 300);
        const extraKmDriven = Math.max(0, travelledKm - includedKm);
        const rawLateHours = (+new Date() - +booking.endDate) / 3600000;
        const extraHours = rawLateHours > 0.5 ? Number(rawLateHours.toFixed(1)) : 0;
        const penaltyCharges =
          extraKmDriven * Number(booking.vehicle.extraKmCharge || 12) +
          Math.ceil(extraHours) * Number(rentalPolicy.lateRatePerHour || 250);

        await tx.trip.upsert({
          where: { bookingId: id },
          update: {
            actualEndTime: new Date(),
            endOdometer: odometer,
            endFuelLevel: fuelPercent,
            endChecklistImages: imageUrlsJson,
            endSelfieUrl: selfieUrl,
            extraKmDriven,
            extraHours,
            penaltyCharges,
            tripStatus: 'completed',
          },
          create: {
            bookingId: id,
            actualEndTime: new Date(),
            startOdometer: startOdo,
            endOdometer: odometer,
            endFuelLevel: fuelPercent,
            endChecklistImages: imageUrlsJson,
            endSelfieUrl: selfieUrl,
            extraKmDriven,
            extraHours,
            penaltyCharges,
            tripStatus: 'completed',
          },
        });

        // Persist the automatic part of the final settlement as soon as the
        // vehicle is returned. Admin can later add documented damage, fuel,
        // toll, fine, cleaning, or other charges through the settlement flow.
        const automaticSettlement = calculateSettlement({
          depositHeld: Number(booking.securityDeposit || 0),
          automaticCharges: penaltyCharges,
        });
        await tx.bookingSettlement.upsert({
          where: { bookingId: id },
          update: {
            ...automaticSettlement,
            status: 'PENDING',
            note: 'Automatic excess-kilometre and late-return charges calculated; operations review required for final release.',
          },
          create: {
            bookingId: id,
            ...automaticSettlement,
            status: 'PENDING',
            note: 'Automatic excess-kilometre and late-return charges calculated; operations review required for final release.',
          },
        });

        // Credit Host Revenue to Host Wallet upon completed trip
        const hostShare = Number(booking.hostRevenue) > 0
          ? Number(booking.hostRevenue)
          : Math.round(Math.max(0, Number(booking.totalAmount) - Number(booking.securityDeposit)) * (1 - rentalPolicy.platformCommissionRate));
        await tx.wallet.upsert({
          where: { userId: booking.vehicle.hostId },
          update: { balance: { increment: hostShare } },
          create: { userId: booking.vehicle.hostId, balance: hostShare },
        });
      }

      await tx.vehicle.update({
        where: { id: booking.vehicleId },
        data: { odometer, fuelLevelPercent: fuelPercent },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: stage,
          targetId: id,
          detail: `${stage} Handover · Odometer ${odometer} km · Fuel ${fuelPercent}% · ${mediaIds.length} photos + selfie verified`,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'VEHICLE_' + stage + '_LOGGED',
          targetId: booking.vehicleId,
          detail: JSON.stringify({ bookingId: id, odometer, fuelPercent, mediaIds, damageNote }),
        },
      });
      return {
        message: stage === 'PICKUP'
          ? 'Trip started! All 8 car angle photos & customer selfie recorded.'
          : 'Trip completed! Return photos & selfie verified and Host revenue credited.',
      };
    });

    const booking = await this.prisma.booking.findUnique({ where: { id }, include: { vehicle: true } });
    if (booking) {
      const event = stage === 'PICKUP'
        ? ['TRIP_STARTED', 'Trip started', `Trip ${booking.bookingRef} has started. 8-angle pickup photos & customer selfie were recorded.`]
        : stage === 'RETURN'
          ? ['TRIP_ENDED', 'Trip ended', `Trip ${booking.bookingRef} has ended. Return photos & selfie were recorded and settlement calculated.`]
          : ['DAMAGE_REPORTED', 'Damage reported', `A damage report was added to trip ${booking.bookingRef}.`];
      await this.notifyBooking(booking, event[0], event[1], event[2]);
    }
    return result;
  }

  private async notifyBooking(booking: any, type: string, title: string, message: string) {
    if (!this.notifications || !booking?.vehicle) return;
    await Promise.allSettled([
      this.notifications.create(booking.customerId, { type, title, message, bookingId: booking.id }),
      this.notifications.create(booking.vehicle.hostId, { type, title, message, bookingId: booking.id }),
    ]);
  }
}
