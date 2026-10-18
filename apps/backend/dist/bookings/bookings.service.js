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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const node_crypto_1 = require("node:crypto");
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const validation_1 = require("../common/validation");
const availability_1 = require("./availability");
const pricing_1 = require("./pricing");
const rental_policy_1 = require("./rental-policy");
const car_sharing_agreement_1 = require("./car-sharing-agreement");
const notifications_service_1 = require("../notifications/notifications.service");
const rental_state_1 = require("../rental-domain/rental-state");
let BookingsService = class BookingsService {
    prisma;
    notifications;
    constructor(prisma, notifications) {
        this.prisma = prisma;
        this.notifications = notifications;
    }
    async create(customerId, data) {
        const vehicleId = (0, validation_1.text)(data.vehicleId, 'Vehicle');
        const requestKey = customerId + ':' + (0, validation_1.text)(data.requestKey, 'Request key', 80);
        const { start, end } = (0, availability_1.rentalPeriod)(data.startDate, data.endDate);
        const booking = await this.prisma.$transaction(async (tx) => {
            const previous = await tx.booking.findUnique({
                where: { requestKey },
                include: { vehicle: true, payment: true, invoice: true, trip: true },
            });
            if (previous) {
                if (previous.vehicleId !== vehicleId || +previous.startDate !== +start || +previous.endDate !== +end) {
                    throw new common_1.ConflictException('Request key already used for another booking');
                }
                return previous;
            }
            const user = await tx.user.findUnique({ where: { id: customerId } });
            if (!user?.isVerified || !user.dlValidUntil || user.dlValidUntil < end) {
                throw new common_1.ForbiddenException('Complete e-KYC & Driving Licence verification valid through your return date before booking.');
            }
            const locked = await tx.vehicle.updateMany({ where: { id: vehicleId }, data: { updatedAt: new Date() } });
            if (!locked.count)
                throw new common_1.NotFoundException('Car is not available');
            const car = await tx.vehicle.findUnique({ where: { id: vehicleId } });
            if (!car || car.status !== 'ACTIVE')
                throw new common_1.NotFoundException('Car is not available');
            if (car.hostId === customerId)
                throw new common_1.BadRequestException('You cannot book your own car');
            const docs = await tx.document.findMany({
                where: { vehicleId, status: 'APPROVED', kind: { in: ['RC', 'INSURANCE', 'PUC'] }, validUntil: { gte: end } },
            });
            if (!['RC', 'INSURANCE', 'PUC'].every(k => docs.some(d => d.kind === k))) {
                throw new common_1.BadRequestException('Vehicle documents must remain valid through your return date');
            }
            await tx.vehicle.update({ where: { id: vehicleId }, data: { updatedAt: new Date() } });
            const conflict = await tx.booking.findFirst({ where: { vehicleId, ...(0, availability_1.overlappingReservations)(start, end) } });
            if (conflict)
                throw new common_1.ConflictException('Car is already reserved for these dates');
            const blocked = await tx.availabilityBlock.findFirst({
                where: { vehicleId, releasedAt: null, startDate: { lt: end }, endDate: { gt: start } },
            });
            if (blocked)
                throw new common_1.ConflictException('The host has blocked this car for the selected dates');
            const { rentalDays, totalAmount, includedKilometres, securityDeposit } = (0, pricing_1.rentalQuote)(car.pricePerDay, start, end);
            if (data.expectedTotal !== undefined && Number(data.expectedTotal) !== totalAmount) {
                throw new common_1.ConflictException('The rental price changed. Refresh your quote before booking.');
            }
            const tenureHours = Math.max(1, Math.ceil((+end - +start) / 3600000));
            const baseFare = Math.max(0, Number(totalAmount) - Number(securityDeposit));
            const platformFee = Math.round(baseFare * rental_policy_1.rentalPolicy.platformCommissionRate);
            const hostRevenue = Math.max(0, baseFare - platformFee);
            const policySnapshot = (0, car_sharing_agreement_1.agreementPolicySnapshot)({
                securityDeposit: rental_policy_1.rentalPolicy.deposit,
                includedKilometresPer24Hours: rental_policy_1.rentalPolicy.kilometresPer24Hours,
                excessKmRate: rental_policy_1.rentalPolicy.excessKmRate,
                lateGraceMinutes: rental_policy_1.rentalPolicy.lateGraceMinutes,
                lateReturnRatePerHour: rental_policy_1.rentalPolicy.lateRatePerHour,
                cancellation: rental_policy_1.rentalPolicy.cancellation,
            });
            const termsSnapshot = (0, car_sharing_agreement_1.carSharingAgreementTerms)(policySnapshot);
            return tx.booking.create({
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
                    bookingRef: 'SF-' + (0, node_crypto_1.randomUUID)().slice(0, 8).toUpperCase(),
                    status: 'PENDING',
                    expiresAt: new Date(Math.min(Date.now() + 30 * 60000, +start)),
                    agreementVersion: car_sharing_agreement_1.CAR_SHARING_AGREEMENT_VERSION,
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
        }, { timeout: 10000 });
        await this.notifyBooking(booking, 'BOOKING_CREATED', 'Booking request received', `Booking ${booking.bookingRef} is awaiting payment confirmation.`);
        return booking;
    }
    async pay(customerId, id, body) {
        const method = body?.method ? String(body.method).toUpperCase() : 'UPI';
        const gatewayProvider = body?.gatewayProvider ? String(body.gatewayProvider) : 'Razorpay';
        const updatedBooking = await this.prisma.$transaction(async (tx) => {
            const booking = await tx.booking.findUnique({
                where: { id },
                include: { vehicle: true, payment: true, invoice: true, customer: true },
            });
            if (!booking)
                throw new common_1.NotFoundException('Booking not found');
            if (booking.customerId !== customerId)
                throw new common_1.ForbiddenException('You can only pay for your own booking');
            if (booking.status === 'CONFIRMED' || booking.status === 'ACTIVE')
                return booking;
            if (booking.status !== 'PENDING')
                throw new common_1.BadRequestException('Only pending bookings can be paid');
            try {
                (0, rental_state_1.assertBookingTransition)(booking.status, 'CONFIRMED');
            }
            catch (error) {
                throw new common_1.BadRequestException(error.message);
            }
            if (booking.expiresAt && booking.expiresAt < new Date()) {
                throw new common_1.BadRequestException('This booking hold has expired. Please create a new booking.');
            }
            const txId = body?.reference
                ? String(body.reference).trim().slice(0, 80)
                : `PAY-${method}-${Date.now().toString(36).toUpperCase()}`;
            const invNo = `INV-${new Date().getFullYear()}-${(0, node_crypto_1.randomUUID)().slice(0, 6).toUpperCase()}`;
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
            }
            else {
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
                    detail: booking.agreementVersion || car_sharing_agreement_1.CAR_SHARING_AGREEMENT_VERSION,
                },
            });
            return tx.booking.findUnique({
                where: { id },
                include: { vehicle: true, payment: true, invoice: true, trip: true, inspections: true },
            });
        });
        if (updatedBooking) {
            await this.notifyBooking(updatedBooking, 'BOOKING_CONFIRMED', 'Payment confirmed & e-Agreement generated', `Booking ${updatedBooking.bookingRef} is confirmed! Your Car Lease e-Agreement is ready. Complete the 8-photo + selfie handover at the hub to start your trip.`);
        }
        return updatedBooking;
    }
    getMyTrips(customerId) {
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
    getHostBookings(hostId) {
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
    async agreement(user, id) {
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
        if (!booking)
            throw new common_1.NotFoundException('Booking not found');
        const isParty = booking.customerId === user.id || booking.vehicle.hostId === user.id || user.role === 'ADMIN';
        if (!isParty)
            throw new common_1.ForbiddenException('Agreement access denied');
        let savedSnapshot = null;
        try {
            savedSnapshot = booking.agreementSnapshot ? JSON.parse(booking.agreementSnapshot) : null;
        }
        catch {
            savedSnapshot = null;
        }
        const policy = (0, car_sharing_agreement_1.agreementPolicySnapshot)(savedSnapshot?.policy || {
            securityDeposit: booking.securityDeposit,
            includedKilometresPer24Hours: booking.includedKilometres || rental_policy_1.rentalPolicy.kilometresPer24Hours,
            excessKmRate: rental_policy_1.rentalPolicy.excessKmRate,
            lateGraceMinutes: rental_policy_1.rentalPolicy.lateGraceMinutes,
            lateReturnRatePerHour: rental_policy_1.rentalPolicy.lateRatePerHour,
            cancellation: rental_policy_1.rentalPolicy.cancellation,
        });
        const agreementVersion = booking.agreementVersion || car_sharing_agreement_1.CAR_SHARING_AGREEMENT_VERSION;
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
            terms: Array.isArray(savedSnapshot?.terms) ? savedSnapshot.terms : (0, car_sharing_agreement_1.carSharingAgreementTerms)(policy),
            cancellationRefundPercent: (0, rental_policy_1.cancellationRefundPercent)(booking.startDate),
            acknowledgement: acknowledgement ? { acceptedAt: acknowledgement.createdAt, version: acknowledgement.detail } : null,
        };
    }
    async acknowledgeAgreement(user, id) {
        const booking = await this.prisma.booking.findUnique({ where: { id }, include: { vehicle: true } });
        if (!booking)
            throw new common_1.NotFoundException('Booking not found');
        if (booking.customerId !== user.id && booking.vehicle.hostId !== user.id && user.role !== 'ADMIN') {
            throw new common_1.ForbiddenException('Agreement access denied');
        }
        const detail = car_sharing_agreement_1.CAR_SHARING_AGREEMENT_VERSION;
        await this.prisma.booking.update({ where: { id }, data: { agreementAcceptedAt: new Date() } });
        const row = await this.prisma.auditLog.create({
            data: { actorId: user.id, action: 'BOOKING_AGREEMENT_ACKNOWLEDGED', targetId: id, detail },
        });
        return { acceptedAt: row.createdAt, version: detail };
    }
    async agreementPdf(user, id) {
        const agreement = await this.agreement(user, id);
        const root = process.cwd();
        const template = [
            (0, node_path_1.resolve)(root, 'templates/Safarcars_Car_Sharing_Agreement.docx'),
            (0, node_path_1.resolve)(root, 'apps/backend/templates/Safarcars_Car_Sharing_Agreement.docx'),
        ].find(path => require('node:fs').existsSync(path));
        const script = [
            (0, node_path_1.resolve)(root, 'scripts/populate_agreement.py'),
            (0, node_path_1.resolve)(root, 'apps/backend/scripts/populate_agreement.py'),
        ].find(path => require('node:fs').existsSync(path));
        const fallbackPdfScript = [
            (0, node_path_1.resolve)(root, 'scripts/docx_to_pdf_reportlab.py'),
            (0, node_path_1.resolve)(root, 'apps/backend/scripts/docx_to_pdf_reportlab.py'),
        ].find(path => require('node:fs').existsSync(path));
        if (!template || !script)
            throw new common_1.BadRequestException('Agreement PDF template is not installed');
        const work = await node_fs_1.promises.mkdtemp((0, node_path_1.join)((0, node_os_1.tmpdir)(), 'safar-agreement-'));
        const dataPath = (0, node_path_1.join)(work, 'agreement.json');
        const docxPath = (0, node_path_1.join)(work, 'agreement.docx');
        await node_fs_1.promises.writeFile(dataPath, JSON.stringify({
            ...agreement,
            trip: agreement.scheduleI?.trip,
            policy: agreement.scheduleIII,
        }), 'utf8');
        const python = process.env.AGREEMENT_PYTHON || 'python';
        await this.runProcess(python, [script, '--template', template, '--data', dataPath, '--output', docxPath], work);
        const pdfPath = (0, node_path_1.join)(work, 'agreement.pdf');
        try {
            const renderer = process.env.AGREEMENT_DOCX_RENDERER;
            if (renderer) {
                await this.runProcess(python, [renderer, docxPath, '--output_dir', work, '--emit_pdf'], work);
            }
            else {
                const soffice = process.env.AGREEMENT_SOFFICE || 'soffice';
                await this.runProcess(soffice, ['--headless', '--convert-to', 'pdf', '--outdir', work, docxPath], work);
            }
        }
        catch (error) {
            if (!fallbackPdfScript)
                throw error;
            await this.runProcess(python, [fallbackPdfScript, '--input', docxPath, '--output', pdfPath], work);
        }
        if (!require('node:fs').existsSync(pdfPath))
            throw new common_1.BadRequestException('Agreement PDF conversion failed');
        const buffer = await node_fs_1.promises.readFile(pdfPath);
        await node_fs_1.promises.rm(work, { recursive: true, force: true });
        return { buffer, fileName: `${agreement.booking.reference || id}-safarcars-agreement.pdf` };
    }
    runProcess(command, args, cwd) {
        return new Promise((resolveProcess, reject) => {
            let child;
            try {
                child = (0, node_child_process_1.spawn)(command, args, { cwd, windowsHide: true });
            }
            catch (error) {
                reject(new common_1.BadRequestException(`Agreement document converter is unavailable: ${error?.message || 'process could not start'}`));
                return;
            }
            let stderr = '';
            child.stderr.on('data', chunk => { stderr += String(chunk); });
            child.on('error', error => reject(new common_1.BadRequestException(`Agreement document converter is unavailable: ${error.message}`)));
            child.on('close', code => code === 0 ? resolveProcess() : reject(new common_1.BadRequestException(`Agreement document conversion failed${stderr ? `: ${stderr.slice(0, 300)}` : ''}`)));
        });
    }
    async cancel(userId, id) {
        const result = await this.prisma.$transaction(async (tx) => {
            const booking = await tx.booking.findUnique({ where: { id }, include: { vehicle: true } });
            if (!booking)
                throw new common_1.NotFoundException('Booking not found');
            if (booking.customerId !== userId && booking.vehicle.hostId !== userId)
                throw new common_1.ForbiddenException('Booking access denied');
            if (!['PENDING', 'CONFIRMED'].includes(booking.status) || booking.startDate <= new Date()) {
                throw new common_1.BadRequestException('Cancellation is only available before pickup');
            }
            try {
                (0, rental_state_1.assertBookingTransition)(booking.status, 'CANCELLED');
            }
            catch (error) {
                throw new common_1.BadRequestException(error.message);
            }
            const changed = await tx.booking.updateMany({ where: { id, status: booking.status }, data: { status: 'CANCELLED' } });
            if (changed.count !== 1)
                throw new common_1.ConflictException('Booking changed; refresh and retry');
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
    async inspect(user, id, body) {
        const stage = (0, validation_1.choice)(body.stage, 'Inspection stage', ['PICKUP', 'RETURN', 'DAMAGE']);
        const odometer = (0, validation_1.number)(body.odometer ?? 0, 'Odometer', 0, 2000000, true);
        const mediaId = (0, validation_1.text)(body.mediaId, stage === 'DAMAGE' ? 'Damage photo' : 'Odometer / primary photo');
        const selfieMediaId = body.selfieMediaId ? (0, validation_1.text)(body.selfieMediaId, 'Customer handover selfie', 100) : null;
        const fuelPercent = (0, validation_1.number)(body.fuelPercent ?? 100, 'Fuel level (%)', 0, 100, true);
        const damageNote = (0, validation_1.text)(body.damageNote || 'Clean — all 8 angles & selfie verified at hub', 'Vehicle condition', 2000);
        const rawIds = [
            mediaId,
            ...(selfieMediaId ? [selfieMediaId] : []),
            ...(Array.isArray(body.mediaIds) ? body.mediaIds : []),
        ];
        const mediaIds = Array.from(new Set(rawIds.map(item => (0, validation_1.text)(item, 'Inspection photo', 100))));
        if (mediaIds.length > 15)
            throw new common_1.BadRequestException('Upload up to 15 handover photos');
        const result = await this.prisma.$transaction(async (tx) => {
            const booking = await tx.booking.findUnique({
                where: { id },
                include: { vehicle: true, inspections: true, trip: true },
            });
            if (!booking)
                throw new common_1.NotFoundException('Booking not found');
            const isHost = booking.vehicle.hostId === user.id || user.role === 'ADMIN';
            const isCustomer = booking.customerId === user.id;
            if (!isCustomer && !isHost)
                throw new common_1.ForbiddenException('Booking customer, host or administrator required');
            if (stage === 'PICKUP' && booking.status !== 'CONFIRMED') {
                throw new common_1.BadRequestException('Only confirmed (paid) bookings can start trip pickup handover');
            }
            if (stage === 'RETURN' && booking.status !== 'ACTIVE') {
                throw new common_1.BadRequestException('Only active trips can complete return handover');
            }
            if (stage === 'DAMAGE' && booking.status !== 'ACTIVE') {
                throw new common_1.BadRequestException('Damage reports are available during an active trip');
            }
            if (stage !== 'DAMAGE') {
                try {
                    (0, rental_state_1.assertBookingTransition)(booking.status, stage === 'PICKUP' ? 'ACTIVE' : 'COMPLETED');
                }
                catch (error) {
                    throw new common_1.BadRequestException(error.message);
                }
            }
            const pickupInspection = booking.inspections.find(i => i.stage === 'PICKUP');
            const minimum = stage === 'RETURN'
                ? (pickupInspection?.odometer ?? booking.trip?.startOdometer ?? booking.vehicle.odometer)
                : booking.vehicle.odometer;
            if (stage !== 'DAMAGE' && minimum !== undefined && odometer < minimum) {
                throw new common_1.BadRequestException(`Odometer cannot be less than ${minimum} km`);
            }
            const allowedKinds = [...validation_1.PHOTO_KINDS, ...validation_1.INSPECTION_KINDS];
            const media = await tx.media.findMany({
                where: { id: { in: mediaIds }, kind: { in: allowedKinds } },
            });
            if (!media.length) {
                throw new common_1.BadRequestException('Upload the required 8 vehicle angle photos and customer selfie');
            }
            const resolvedSelfie = selfieMediaId ||
                media.find(m => m.kind === 'SELFIE_PICKUP' || m.kind === 'SELFIE_RETURN')?.id ||
                null;
            if (stage !== 'DAMAGE' && !resolvedSelfie) {
                throw new common_1.BadRequestException('Customer handover selfie is mandatory to start or end a trip');
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
                        note: body.note ? (0, validation_1.text)(body.note, 'Inspection note', 1000) : null,
                    },
                    create: {
                        bookingId: id,
                        stage,
                        odometer,
                        mediaId,
                        mediaIds: JSON.stringify(mediaIds),
                        fuelPercent,
                        damageNote,
                        note: body.note ? (0, validation_1.text)(body.note, 'Inspection note', 1000) : null,
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
            if (updated.count !== 1)
                throw new common_1.ConflictException('Trip status already changed');
            await tx.inspection.upsert({
                where: { bookingId_stage: { bookingId: id, stage } },
                update: {
                    odometer,
                    mediaId,
                    mediaIds: JSON.stringify(mediaIds),
                    selfieMediaId: resolvedSelfie,
                    fuelPercent,
                    damageNote,
                    note: body.note ? (0, validation_1.text)(body.note, 'Inspection note', 1000) : null,
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
                    note: body.note ? (0, validation_1.text)(body.note, 'Inspection note', 1000) : null,
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
            }
            else if (stage === 'RETURN') {
                const startOdo = pickupInspection?.odometer ?? booking.trip?.startOdometer ?? booking.vehicle.odometer;
                const travelledKm = Math.max(0, odometer - startOdo);
                const includedKm = booking.includedKilometres || (booking.rentalDays * 300);
                const extraKmDriven = Math.max(0, travelledKm - includedKm);
                const rawLateHours = (+new Date() - +booking.endDate) / 3600000;
                const extraHours = rawLateHours > 0.5 ? Number(rawLateHours.toFixed(1)) : 0;
                const penaltyCharges = extraKmDriven * Number(booking.vehicle.extraKmCharge || 12) +
                    Math.ceil(extraHours) * Number(rental_policy_1.rentalPolicy.lateRatePerHour || 250);
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
                const depositHeld = Number(booking.securityDeposit || 0);
                const refundAmount = Math.max(0, depositHeld - penaltyCharges);
                const additionalAmountDue = Math.max(0, penaltyCharges - depositHeld);
                await tx.bookingSettlement.upsert({
                    where: { bookingId: id },
                    update: {
                        depositHeld,
                        automaticCharges: penaltyCharges,
                        totalDeduction: penaltyCharges,
                        refundAmount,
                        additionalAmountDue,
                        status: 'PENDING',
                        note: 'Automatic excess-kilometre and late-return charges calculated; operations review required for final release.',
                    },
                    create: {
                        bookingId: id,
                        depositHeld,
                        automaticCharges: penaltyCharges,
                        totalDeduction: penaltyCharges,
                        refundAmount,
                        additionalAmountDue,
                        status: 'PENDING',
                        note: 'Automatic excess-kilometre and late-return charges calculated; operations review required for final release.',
                    },
                });
                const hostShare = Number(booking.hostRevenue) > 0
                    ? Number(booking.hostRevenue)
                    : Math.round(Math.max(0, Number(booking.totalAmount) - Number(booking.securityDeposit)) * (1 - rental_policy_1.rentalPolicy.platformCommissionRate));
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
    async notifyBooking(booking, type, title, message) {
        if (!this.notifications || !booking?.vehicle)
            return;
        await Promise.allSettled([
            this.notifications.create(booking.customerId, { type, title, message, bookingId: booking.id }),
            this.notifications.create(booking.vehicle.hostId, { type, title, message, bookingId: booking.id }),
        ]);
    }
};
exports.BookingsService = BookingsService;
exports.BookingsService = BookingsService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, notifications_service_1.NotificationsService])
], BookingsService);
//# sourceMappingURL=bookings.service.js.map