import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { choice, text } from '../common/validation';

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(user: { id: string; role: string }) {
    if (user.role === 'ADMIN') return this.adminDashboard();
    if (user.role === 'HOST' || user.role === 'DEALER') return this.fleetDashboard(user.id, user.role);
    return this.customerDashboard(user.id);
  }

  private async customerDashboard(userId: string) {
    const now = new Date();
    const [user, counts, upcoming, recent, disputes] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, firstName: true, lastName: true, email: true, phone: true, phoneVerifiedAt: true, isVerified: true, dlValidUntil: true, profile: true },
      }),
      this.prisma.booking.groupBy({ by: ['status'], where: { customerId: userId }, _count: { _all: true } }),
      this.prisma.booking.findMany({
        where: { customerId: userId, endDate: { gte: now }, status: { in: ['PENDING', 'CONFIRMED', 'ACTIVE'] } },
        include: { vehicle: { select: { id: true, make: true, model: true, year: true, locationCity: true, registrationNumber: true } }, payment: { select: { status: true } } },
        orderBy: { startDate: 'asc' }, take: 5,
      }),
      this.prisma.booking.findMany({
        where: { customerId: userId },
        include: { vehicle: { select: { make: true, model: true, locationCity: true } }, payment: { select: { status: true } }, invoice: { select: { number: true, status: true } } },
        orderBy: { createdAt: 'desc' }, take: 10,
      }),
      this.listDisputes(userId),
    ]);
    return {
      role: 'CUSTOMER',
      profile: user,
      kyc: { verified: Boolean(user?.isVerified), dlValidUntil: user?.dlValidUntil || null },
      bookingCounts: Object.fromEntries(counts.map(item => [item.status, item._count._all])),
      upcoming,
      recent,
      disputes,
    };
  }

  private async fleetDashboard(userId: string, role: string) {
    const [profile, vehicles, bookings, revenue, disputes] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, firstName: true, lastName: true, email: true, phone: true, phoneVerifiedAt: true, isVerified: true, profile: true } }),
      this.prisma.vehicle.findMany({
        where: { hostId: userId },
        select: { id: true, make: true, model: true, year: true, locationCity: true, registrationNumber: true, pricePerDay: true, status: true, odometer: true, documents: { select: { kind: true, status: true, validUntil: true } }, media: { select: { kind: true } } },
        orderBy: { createdAt: 'desc' }, take: 100,
      }),
      this.prisma.booking.findMany({
        where: { vehicle: { hostId: userId } },
        include: { vehicle: { select: { make: true, model: true, registrationNumber: true } }, customer: { select: { firstName: true, lastName: true, phone: true } }, payment: { select: { amount: true, status: true } }, inspections: { select: { stage: true, createdAt: true } } },
        orderBy: { startDate: 'desc' }, take: 100,
      }),
      this.prisma.payment.aggregate({ where: { status: 'SUCCESS', booking: { vehicle: { hostId: userId } } }, _sum: { amount: true }, _count: { _all: true } }),
      this.listDisputes(userId),
    ]);
    return {
      role,
      profile,
      fleet: { total: vehicles.length, active: vehicles.filter(v => v.status === 'ACTIVE').length, pendingApproval: vehicles.filter(v => v.status === 'PENDING_APPROVAL').length, vehicles },
      bookings,
      earnings: { grossCollected: Number(revenue._sum.amount || 0), paidBookings: revenue._count._all, payoutStatus: 'MANUAL_RECONCILIATION_PENDING' },
      disputes,
    };
  }

  private async adminDashboard() {
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const [users, vehicles, bookings, documents, payments, todayPayments, pendingRefunds, disputes] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.vehicle.count(),
      this.prisma.booking.count(),
      this.prisma.document.count({ where: { status: 'PENDING' } }),
      this.prisma.payment.aggregate({ where: { status: 'SUCCESS' }, _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.payment.aggregate({ where: { status: 'SUCCESS', createdAt: { gte: today } }, _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.payment.count({ where: { status: 'REFUND_PENDING' } }),
      this.prisma.auditLog.count({ where: { action: 'BOOKING_DISPUTE' } }),
    ]);
    return {
      role: 'ADMIN',
      metrics: {
        users, vehicles, bookings, pendingDocuments: documents, pendingRefunds, disputes,
        totalCollected: Number(payments._sum.amount || 0), totalPaidBookings: payments._count._all,
        todayCollected: Number(todayPayments._sum.amount || 0), todayPaidBookings: todayPayments._count._all,
      },
    };
  }

  async updateProfile(userId: string, body: any) {
    const firstName = text(body.firstName, 'First name', 80);
    const lastName = text(body.lastName, 'Last name', 80);
    const city = body.city ? text(body.city, 'City', 80) : 'Ahmedabad';
    const state = body.state ? text(body.state, 'State', 80) : 'Gujarat';
    const postalCode = body.postalCode ? String(body.postalCode).trim().slice(0, 12) : undefined;
    const phone = body.phone ? String(body.phone).trim().slice(0, 20) : undefined;

    if (phone) {
      const existing = await this.prisma.user.findFirst({ where: { phone, NOT: { id: userId } } });
      if (existing) throw new BadRequestException('This phone number is already registered with another account.');
    }

    const updated = await this.prisma.$transaction(async tx => {
      const u = await tx.user.update({
        where: { id: userId },
        data: { firstName, lastName, ...(phone ? { phone } : {}) },
      });
      await tx.userProfile.upsert({
        where: { userId },
        update: { firstName, lastName, city, state, ...(postalCode !== undefined ? { postalCode } : {}) },
        create: { userId, firstName, lastName, city, state, ...(postalCode !== undefined ? { postalCode } : {}) },
      });
      await tx.auditLog.create({
        data: { actorId: userId, action: 'PROFILE_UPDATED', targetId: userId, detail: `${firstName} ${lastName} (${city}, ${state})` },
      });
      return u;
    });

    return { ok: true, firstName: updated.firstName, lastName: updated.lastName, phone: updated.phone };
  }

  async changePassword(userId: string, body: any) {
    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');
    if (!currentPassword) throw new BadRequestException('Current password is required.');
    if (newPassword.length < 8) throw new BadRequestException('New password must be at least 8 characters.');

    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u) throw new NotFoundException('Account not found.');
    const valid = await bcrypt.compare(currentPassword, u.passwordHash);
    if (!valid) throw new ForbiddenException('Current password is incorrect.');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.prisma.auditLog.create({
      data: { actorId: userId, action: 'PASSWORD_CHANGED', targetId: userId, detail: 'Customer changed account password' },
    });
    return { ok: true };
  }

  async listDisputes(userId: string) {
    const logs = await this.prisma.auditLog.findMany({
      where: { actorId: userId, action: 'BOOKING_DISPUTE' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    if (!logs.length) return [];
    const responses = await this.prisma.auditLog.findMany({
      where: { action: 'DISPUTE_RESPONSE', targetId: { in: logs.map(l => l.id) } },
      orderBy: { createdAt: 'asc' },
    });
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
        history,
        createdAt: log.createdAt,
      };
    });
  }

  async createDispute(userId: string, body: any) {
    const bookingId = text(body.bookingId, 'Booking', 80);
    const category = choice(body.category, 'Dispute category', [
      'BILLING',
      'DEPOSIT_REFUND',
      'VEHICLE_CONDITION',
      'HANDOVER_ISSUE',
      'DAMAGE_APPEAL',
      'CANCELLATION_REFUND',
    ]);
    const description = text(body.description, 'Dispute description', 2000);
    const amountClaimed = body.amountClaimed ? Number(body.amountClaimed) || 0 : 0;
    const mediaId = body.mediaId ? String(body.mediaId).trim() : null;

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { vehicle: true },
    });
    if (!booking || (booking.customerId !== userId && booking.vehicle.hostId !== userId)) {
      throw new ForbiddenException('Select a booking associated with your account.');
    }

    const reference = 'DSP-' + Date.now().toString(36).toUpperCase().slice(-6);
    const payload = {
      reference,
      bookingId: booking.id,
      bookingRef: booking.bookingRef,
      vehicleTitle: `${booking.vehicle.make} ${booking.vehicle.model} (${booking.vehicle.year})`,
      category,
      description,
      amountClaimed,
      mediaId,
      status: 'SUBMITTED',
    };

    const record = await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'BOOKING_DISPUTE',
        targetId: booking.id,
        detail: JSON.stringify(payload),
      },
    });

    await this.prisma.notification.create({
      data: {
        userId,
        bookingId: booking.id,
        type: 'DISPUTE_SUBMITTED',
        title: `Dispute ${reference} submitted`,
        message: `Your dispute regarding booking ${booking.bookingRef} (${category.replaceAll('_', ' ')}) has been logged for review.`,
      },
    });

    return { id: record.id, ...payload, createdAt: record.createdAt };
  }

  async requestAccountDeletion(userId: string, body: any) {
    const reason = text(body.reason || 'Customer requested account closure', 'Reason', 1000);
    const activeBooking = await this.prisma.booking.findFirst({
      where: { customerId: userId, status: { in: ['CONFIRMED', 'ACTIVE'] } },
    });
    if (activeBooking) {
      throw new BadRequestException('Complete or cancel active bookings before requesting account deletion.');
    }
    await this.prisma.auditLog.create({
      data: { actorId: userId, action: 'ACCOUNT_DELETION_REQUESTED', targetId: userId, detail: reason },
    });
    await this.prisma.notification.create({
      data: {
        userId,
        type: 'ACCOUNT_DELETION_REQUEST',
        title: 'Account deletion request received',
        message: 'Our compliance team will verify that all trip settlements and deposits are closed before completing your deletion request.',
      },
    });
    return { ok: true };
  }
}
