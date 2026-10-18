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
exports.PaymentWebhookController = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const node_crypto_2 = require("node:crypto");
const prisma_service_1 = require("../prisma/prisma.service");
let PaymentWebhookController = class PaymentWebhookController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async webhook(req, headers) {
        const secret = process.env.PAYMENT_WEBHOOK_SECRET;
        if (!secret)
            throw new common_1.HttpException('Payment webhook is not configured', common_1.HttpStatus.SERVICE_UNAVAILABLE);
        const signatureHeader = headers['x-razorpay-signature'] || headers['x-payment-signature'] || headers['x-signature'];
        const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
        if (!signature)
            throw new common_1.HttpException('Missing payment signature', common_1.HttpStatus.UNAUTHORIZED);
        const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
        const expected = (0, node_crypto_1.createHmac)('sha256', secret).update(raw).digest('hex');
        const supplied = String(signature).trim().replace(/^sha256=/i, '');
        const expectedBuf = Buffer.from(expected, 'utf8');
        const suppliedBuf = Buffer.from(supplied, 'utf8');
        if (expectedBuf.length !== suppliedBuf.length || !(0, node_crypto_1.timingSafeEqual)(expectedBuf, suppliedBuf)) {
            throw new common_1.HttpException('Invalid payment signature', common_1.HttpStatus.UNAUTHORIZED);
        }
        let event;
        try {
            event = JSON.parse(raw.toString('utf8'));
        }
        catch {
            throw new common_1.HttpException('Invalid payment payload', common_1.HttpStatus.BAD_REQUEST);
        }
        const paymentEntity = event?.payload?.payment?.entity || event?.payment || event;
        const transactionId = String(paymentEntity?.id || paymentEntity?.payment_id || event?.transactionId || '').trim().slice(0, 80);
        const notes = paymentEntity?.notes || event?.notes || {};
        const bookingId = String(notes.bookingId || notes.booking_id || event?.bookingId || paymentEntity?.bookingId || '').trim();
        if (!transactionId || !bookingId)
            throw new common_1.HttpException('Payment id and booking id are required', common_1.HttpStatus.BAD_REQUEST);
        const status = /failed|cancelled|canceled/i.test(String(event?.event || event?.status || '')) ? 'FAILED' : 'SUCCESS';
        const amountRaw = paymentEntity?.amount ?? event?.amount;
        const amount = amountRaw == null ? null : Number(amountRaw) > 100000 ? Number(amountRaw) / 100 : Number(amountRaw);
        return this.prisma.$transaction(async (tx) => {
            const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: { payment: true, invoice: true, vehicle: true, customer: true } });
            if (!booking)
                throw new common_1.HttpException('Booking not found', common_1.HttpStatus.NOT_FOUND);
            if (amount != null && (!Number.isFinite(amount) || Math.abs(amount - Number(booking.totalAmount)) > 0.01)) {
                throw new common_1.HttpException('Payment amount does not match booking total', common_1.HttpStatus.BAD_REQUEST);
            }
            if (booking.payment?.transactionId === transactionId)
                return { ok: true, idempotent: true, bookingId, status: booking.payment.status };
            if (booking.payment && booking.payment.transactionId !== transactionId)
                throw new common_1.HttpException('Booking already has a different payment reference', common_1.HttpStatus.CONFLICT);
            const provider = String(paymentEntity?.gatewayProvider || event?.gatewayProvider || 'Razorpay').slice(0, 40);
            if (booking.payment)
                await tx.payment.update({ where: { bookingId }, data: { transactionId, gatewayProvider: provider, amount: Number(booking.totalAmount), status } });
            else
                await tx.payment.create({ data: { bookingId, transactionId, gatewayProvider: provider, paymentType: 'booking_fare', amount: Number(booking.totalAmount), currency: 'INR', status } });
            if (status === 'SUCCESS' && booking.status === 'PENDING') {
                await tx.booking.update({ where: { id: bookingId }, data: { status: 'CONFIRMED', agreementAcceptedAt: new Date() } });
                if (!booking.invoice) {
                    const invoiceNumber = `INV-${new Date().getFullYear()}-${(0, node_crypto_2.randomUUID)().slice(0, 6).toUpperCase()}`;
                    await tx.invoice.create({ data: { bookingId, number: invoiceNumber, amount: booking.totalAmount, currency: 'INR', status: 'PAID', snapshot: JSON.stringify({ invoiceNumber, bookingRef: booking.bookingRef, paymentReference: transactionId, paidAt: new Date().toISOString(), totalAmount: Number(booking.totalAmount), rentalAmount: Number(booking.baseFare), securityDeposit: Number(booking.securityDeposit) }) } });
                }
            }
            await tx.auditLog.create({ data: { actorId: booking.customerId, action: status === 'SUCCESS' ? 'PAYMENT_WEBHOOK_CONFIRMED' : 'PAYMENT_WEBHOOK_FAILED', targetId: bookingId, detail: JSON.stringify({ transactionId, provider, amount }) } });
            return { ok: true, idempotent: false, bookingId, status };
        });
    }
};
exports.PaymentWebhookController = PaymentWebhookController;
__decorate([
    (0, common_1.Post)('webhook'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PaymentWebhookController.prototype, "webhook", null);
exports.PaymentWebhookController = PaymentWebhookController = __decorate([
    (0, common_1.Controller)('payments'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PaymentWebhookController);
//# sourceMappingURL=payment-webhook.controller.js.map