import { Controller, Headers, HttpException, HttpStatus, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Provider-neutral payment callback. A real gateway must call this endpoint
 * only after configuring PAYMENT_WEBHOOK_SECRET and signing the raw request
 * body. The local /bookings/:id/pay path remains available for development.
 */
@Controller('payments')
export class PaymentWebhookController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('webhook')
  async webhook(@Req() req: Request, @Headers() headers: Record<string, string | string[] | undefined>) {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET;
    if (!secret) throw new HttpException('Payment webhook is not configured', HttpStatus.SERVICE_UNAVAILABLE);
    const signatureHeader = headers['x-razorpay-signature'] || headers['x-payment-signature'] || headers['x-signature'];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    if (!signature) throw new HttpException('Missing payment signature', HttpStatus.UNAUTHORIZED);
    const raw = Buffer.isBuffer((req as any).body) ? (req as any).body : Buffer.from(JSON.stringify((req as any).body || {}));
    const expected = createHmac('sha256', secret).update(raw).digest('hex');
    const supplied = String(signature).trim().replace(/^sha256=/i, '');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const suppliedBuf = Buffer.from(supplied, 'utf8');
    if (expectedBuf.length !== suppliedBuf.length || !timingSafeEqual(expectedBuf, suppliedBuf)) {
      throw new HttpException('Invalid payment signature', HttpStatus.UNAUTHORIZED);
    }

    let event: any;
    try { event = JSON.parse(raw.toString('utf8')); } catch { throw new HttpException('Invalid payment payload', HttpStatus.BAD_REQUEST); }
    const paymentEntity = event?.payload?.payment?.entity || event?.payment || event;
    const transactionId = String(paymentEntity?.id || paymentEntity?.payment_id || event?.transactionId || '').trim().slice(0, 80);
    const notes = paymentEntity?.notes || event?.notes || {};
    const bookingId = String(notes.bookingId || notes.booking_id || event?.bookingId || paymentEntity?.bookingId || '').trim();
    if (!transactionId || !bookingId) throw new HttpException('Payment id and booking id are required', HttpStatus.BAD_REQUEST);

    const status = /failed|cancelled|canceled/i.test(String(event?.event || event?.status || '')) ? 'FAILED' : 'SUCCESS';
    const amountRaw = paymentEntity?.amount ?? event?.amount;
    const amount = amountRaw == null ? null : Number(amountRaw) > 100000 ? Number(amountRaw) / 100 : Number(amountRaw);

    return this.prisma.$transaction(async tx => {
      const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: { payment: true, invoice: true, vehicle: true, customer: true } });
      if (!booking) throw new HttpException('Booking not found', HttpStatus.NOT_FOUND);
      if (amount != null && (!Number.isFinite(amount) || Math.abs(amount - Number(booking.totalAmount)) > 0.01)) {
        throw new HttpException('Payment amount does not match booking total', HttpStatus.BAD_REQUEST);
      }
      if (booking.payment?.transactionId === transactionId) return { ok: true, idempotent: true, bookingId, status: booking.payment.status };
      // A checkout creates an INITIATED row using the Razorpay order ID. The
      // webhook legitimately replaces that order ID with the final payment ID.
      if (booking.payment && booking.payment.status !== 'INITIATED' && booking.payment.transactionId !== transactionId) {
        throw new HttpException('Booking already has a different payment reference', HttpStatus.CONFLICT);
      }

      const provider = String(paymentEntity?.gatewayProvider || event?.gatewayProvider || 'Razorpay').slice(0, 40);
      if (booking.payment) await tx.payment.update({ where: { bookingId }, data: { transactionId, gatewayProvider: provider, amount: Number(booking.totalAmount), status } });
      else await tx.payment.create({ data: { bookingId, transactionId, gatewayProvider: provider, paymentType: 'booking_fare', amount: Number(booking.totalAmount), currency: 'INR', status } });
      if (status === 'SUCCESS' && booking.status === 'PENDING') {
        await tx.booking.update({ where: { id: bookingId }, data: { status: 'CONFIRMED', agreementAcceptedAt: new Date() } });
        if (!booking.invoice) {
          const invoiceNumber = `INV-${new Date().getFullYear()}-${randomUUID().slice(0, 6).toUpperCase()}`;
          await tx.invoice.create({ data: { bookingId, number: invoiceNumber, amount: booking.totalAmount, currency: 'INR', status: 'PAID', snapshot: JSON.stringify({ invoiceNumber, bookingRef: booking.bookingRef, paymentReference: transactionId, paidAt: new Date().toISOString(), totalAmount: Number(booking.totalAmount), rentalAmount: Number(booking.baseFare), securityDeposit: Number(booking.securityDeposit) }) } });
        }
      }
      await tx.auditLog.create({ data: { actorId: booking.customerId, action: status === 'SUCCESS' ? 'PAYMENT_WEBHOOK_CONFIRMED' : 'PAYMENT_WEBHOOK_FAILED', targetId: bookingId, detail: JSON.stringify({ transactionId, provider, amount }) } });
      return { ok: true, idempotent: false, bookingId, status };
    });
  }
}
