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
exports.PaymentGatewayService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let PaymentGatewayService = class PaymentGatewayService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createRazorpayOrder(customerId, bookingId) {
        const keyId = process.env.RAZORPAY_KEY_ID;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        if (!keyId || !keySecret) {
            throw new common_1.ServiceUnavailableException('Payment gateway is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
        }
        const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, include: { payment: true, customer: true } });
        if (!booking)
            throw new common_1.BadRequestException('Booking not found');
        if (booking.customerId !== customerId)
            throw new common_1.ForbiddenException('You can only pay for your own booking');
        if (booking.status !== 'PENDING')
            throw new common_1.ConflictException('Only pending bookings can be paid');
        if (booking.expiresAt && booking.expiresAt <= new Date())
            throw new common_1.ConflictException('This booking hold has expired');
        if (booking.payment?.status === 'SUCCESS')
            throw new common_1.ConflictException('This booking is already paid');
        if (booking.payment?.status === 'INITIATED' && booking.payment.gatewayProvider === 'Razorpay') {
            const amountPaise = Math.round(Number(booking.totalAmount) * 100);
            return {
                provider: 'Razorpay',
                keyId,
                orderId: booking.payment.transactionId,
                bookingId,
                bookingRef: booking.bookingRef,
                amount: amountPaise,
                currency: 'INR',
                customer: { name: `${booking.customer.firstName} ${booking.customer.lastName}`, email: booking.customer.email, phone: booking.customer.phone },
            };
        }
        const amountPaise = Math.round(Number(booking.totalAmount) * 100);
        const response = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
                Authorization: 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64'),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount: amountPaise,
                currency: 'INR',
                receipt: booking.bookingRef,
                notes: { bookingId: booking.id, bookingRef: booking.bookingRef, customerId },
            }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.id) {
            throw new common_1.ServiceUnavailableException(payload?.error?.description || 'Payment gateway order creation failed');
        }
        await this.prisma.$transaction(async (tx) => {
            const existing = await tx.payment.findUnique({ where: { bookingId } });
            if (existing?.status === 'SUCCESS')
                throw new common_1.ConflictException('This booking is already paid');
            if (existing) {
                await tx.payment.update({ where: { bookingId }, data: { transactionId: String(payload.id), gatewayProvider: 'Razorpay', status: 'INITIATED', amount: booking.totalAmount } });
            }
            else {
                await tx.payment.create({ data: { bookingId, transactionId: String(payload.id), gatewayProvider: 'Razorpay', paymentType: 'booking_fare', amount: booking.totalAmount, currency: 'INR', status: 'INITIATED' } });
            }
            await tx.auditLog.create({ data: { actorId: customerId, action: 'PAYMENT_CHECKOUT_CREATED', targetId: bookingId, detail: JSON.stringify({ orderId: payload.id, amountPaise }) } });
        });
        return {
            provider: 'Razorpay',
            keyId,
            orderId: String(payload.id),
            bookingId,
            bookingRef: booking.bookingRef,
            amount: amountPaise,
            currency: 'INR',
            customer: { name: `${booking.customer.firstName} ${booking.customer.lastName}`, email: booking.customer.email, phone: booking.customer.phone },
        };
    }
};
exports.PaymentGatewayService = PaymentGatewayService;
exports.PaymentGatewayService = PaymentGatewayService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PaymentGatewayService);
//# sourceMappingURL=payment-gateway.service.js.map