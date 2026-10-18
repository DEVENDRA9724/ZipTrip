import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Small in-process reconciliation worker. It is deliberately idempotent: all
 * state changes use the current state in their WHERE clause, so a retry cannot
 * cancel an already-paid booking or repeatedly suspend a vehicle.
 */
@Injectable()
export class OperationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OperationsService.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationsService) {}

  onModuleInit() {
    if (process.env.ENABLE_OPERATIONS_JOBS === 'false') return;
    const intervalMs = Math.max(30_000, Number(process.env.OPERATIONS_JOB_INTERVAL_MS || 300_000));
    this.timer = setInterval(() => void this.reconcile().catch(error => this.logger.error(error)), intervalMs);
    this.timer.unref();
    void this.reconcile().catch(error => this.logger.error(error));
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async reconcile(now = new Date()) {
    const expiredHolds = await this.prisma.booking.findMany({
      where: { status: 'PENDING', expiresAt: { lte: now } },
      select: { id: true, bookingRef: true, customerId: true },
      take: 200,
    });
    let holdsReleased = 0;
    for (const hold of expiredHolds) {
      const changed = await this.prisma.booking.updateMany({
        where: { id: hold.id, status: 'PENDING', expiresAt: { lte: now } },
        data: { status: 'CANCELLED', expiresAt: null },
      });
      if (!changed.count) continue;
      holdsReleased += 1;
      await this.prisma.auditLog.create({
        data: { actorId: hold.customerId, action: 'BOOKING_HOLD_EXPIRED', targetId: hold.id, detail: hold.bookingRef },
      });
      await this.notifications.create(hold.customerId, {
        type: 'BOOKING_EXPIRED',
        title: 'Booking hold expired',
        message: `Booking ${hold.bookingRef} was released because payment was not completed in time.`,
        bookingId: hold.id,
      });
    }

    const expiredVehicles = await this.prisma.vehicle.findMany({
      where: {
        status: 'ACTIVE',
        documents: { some: { kind: { in: ['RC', 'INSURANCE', 'PUC'] }, status: 'APPROVED', validUntil: { lt: now } } },
      },
      select: { id: true, hostId: true, registrationNumber: true },
      take: 200,
    });
    let vehiclesSuspended = 0;
    for (const vehicle of expiredVehicles) {
      const changed = await this.prisma.vehicle.updateMany({ where: { id: vehicle.id, status: 'ACTIVE' }, data: { status: 'INACTIVE' } });
      if (!changed.count) continue;
      vehiclesSuspended += 1;
      await this.prisma.auditLog.create({
        data: { actorId: vehicle.hostId, action: 'VEHICLE_SUSPENDED_DOCUMENT_EXPIRY', targetId: vehicle.id, detail: vehicle.registrationNumber || vehicle.id },
      });
      await this.notifications.create(vehicle.hostId, {
        type: 'VEHICLE_DOCUMENT_EXPIRED',
        title: 'Vehicle listing suspended',
        message: `Vehicle ${vehicle.registrationNumber || ''} was suspended because an RC, insurance, or PUC document expired.`,
      });
    }

    return { checkedAt: now.toISOString(), holdsReleased, vehiclesSuspended };
  }
}
