import { Injectable, ConflictException, ForbiddenException, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentGatewayService {
  constructor(private readonly prisma: PrismaService) {}

  async createRazorpayOrder(customerId: string, bookingId: string) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new ServiceUnavailableException('Payment gateway is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
    }

    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, include: { payment: true, customer: true } });
    if (!booking) throw new BadRequestException('Booking not found');
    if (booking.customerId !== customerId) throw new ForbiddenException('You can only pay for your own booking');
    if (booking.status !== 'PENDING') throw new ConflictException('Only pending bookings can be paid');
    if (booking.expiresAt && booking.expiresAt <= new Date()) throw new ConflictException('This booking hold has expired');
    if (booking.payment?.status === 'SUCCESS') throw new ConflictException('This booking is already paid');
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
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.id) {
      throw new ServiceUnavailableException(payload?.error?.description || 'Payment gateway order creation failed');
    }

    await this.prisma.$transaction(async tx => {
      const existing = await tx.payment.findUnique({ where: { bookingId } });
      if (existing?.status === 'SUCCESS') throw new ConflictException('This booking is already paid');
      if (existing) {
        await tx.payment.update({ where: { bookingId }, data: { transactionId: String(payload.id), gatewayProvider: 'Razorpay', status: 'INITIATED', amount: booking.totalAmount } });
      } else {
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
}
