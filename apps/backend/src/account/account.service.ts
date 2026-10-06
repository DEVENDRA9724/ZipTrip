import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
    const [user, counts, upcoming, recent] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, firstName: true, lastName: true, email: true, phone: true, isVerified: true, dlValidUntil: true },
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
    ]);
    return {
      role: 'CUSTOMER',
      profile: user,
      kyc: { verified: Boolean(user?.isVerified), dlValidUntil: user?.dlValidUntil || null },
      bookingCounts: Object.fromEntries(counts.map(item => [item.status, item._count._all])),
      upcoming,
      recent,
    };
  }

  private async fleetDashboard(userId: string, role: string) {
    const [profile, vehicles, bookings, revenue] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, firstName: true, lastName: true, email: true, phone: true, isVerified: true } }),
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
    ]);
    return {
      role,
      profile,
      fleet: { total: vehicles.length, active: vehicles.filter(v => v.status === 'ACTIVE').length, pendingApproval: vehicles.filter(v => v.status === 'PENDING_APPROVAL').length, vehicles },
      bookings,
      earnings: { grossCollected: Number(revenue._sum.amount || 0), paidBookings: revenue._count._all, payoutStatus: 'MANUAL_RECONCILIATION_PENDING' },
    };
  }

  private async adminDashboard() {
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const [users, vehicles, bookings, documents, payments, todayPayments, pendingRefunds] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.vehicle.count(),
      this.prisma.booking.count(),
      this.prisma.document.count({ where: { status: 'PENDING' } }),
      this.prisma.payment.aggregate({ where: { status: 'SUCCESS' }, _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.payment.aggregate({ where: { status: 'SUCCESS', createdAt: { gte: today } }, _sum: { amount: true }, _count: { _all: true } }),
      this.prisma.payment.count({ where: { status: 'REFUND_PENDING' } }),
    ]);
    return {
      role: 'ADMIN',
      metrics: {
        users, vehicles, bookings, pendingDocuments: documents, pendingRefunds,
        totalCollected: Number(payments._sum.amount || 0), totalPaidBookings: payments._count._all,
        todayCollected: Number(todayPayments._sum.amount || 0), todayPaidBookings: todayPayments._count._all,
      },
    };
  }
}
