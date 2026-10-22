import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const HOLD_EXPIRED = 'HOLD_EXPIRED';
const BATCH_SIZE = 100;

// Releases unpaid checkout holds whose 30-minute window has passed. Each hold is cancelled in its own transaction through the
// same status guard used elsewhere (PENDING + expiresAt <= now + no payment), and the HOLD_EXPIRED audit row is written only
// when that guarded update wins. Overlapping runs on several backend instances therefore cancel and audit each hold once,
// and CONFIRMED/ACTIVE bookings are never touched. Availability and dashboards already ignore expired holds before the sweep.
@Injectable()
export class HoldExpiryService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(HoldExpiryService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  constructor(private readonly prisma: PrismaService) {}

  onApplicationBootstrap() {
    // HOLD_EXPIRY_INTERVAL_MS=0 disables the in-process schedule (for example when an external scheduler calls expireHolds).
    // Test runs (NODE_ENV=test) boot the app without sweeping unless an interval is set explicitly.
    const configured = process.env.HOLD_EXPIRY_INTERVAL_MS;
    const interval =
      configured === undefined
        ? process.env.NODE_ENV === 'test'
          ? 0
          : 60000
        : Number(configured);
    if (!Number.isFinite(interval) || interval <= 0) return;
    const tick = () =>
      void this.expireHolds().catch((error: Error) =>
        this.logger.error(`Hold expiry sweep failed: ${error?.message}`),
      );
    this.timer = setInterval(tick, Math.max(interval, 5000));
    this.timer.unref();
    tick();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async expireHolds(now = new Date()) {
    if (this.running) return { expired: 0 };
    this.running = true;
    let expired = 0;
    try {
      const candidates = await this.prisma.booking.findMany({
        where: {
          status: 'PENDING',
          expiresAt: { lte: now },
          payment: { is: null },
        },
        select: { id: true },
        orderBy: { expiresAt: 'asc' },
        take: BATCH_SIZE,
      });
      for (const { id } of candidates) {
        const cancelled = await this.prisma.$transaction(async (tx) => {
          // expiresAt is kept so the record still shows when the hold lapsed.
          const changed = await tx.booking.updateMany({
            where: {
              id,
              status: 'PENDING',
              expiresAt: { lte: now },
              payment: { is: null },
            },
            data: { status: 'CANCELLED' },
          });
          if (changed.count !== 1) return false;
          const booking = await tx.booking.findUnique({
            where: { id },
            select: { expiresAt: true, vehicleId: true, customerId: true },
          });
          await tx.auditLog.create({
            data: {
              actorId: 'SYSTEM',
              action: HOLD_EXPIRED,
              targetId: id,
              detail: JSON.stringify({
                reason: HOLD_EXPIRED,
                expiresAt: booking?.expiresAt,
                vehicleId: booking?.vehicleId,
                customerId: booking?.customerId,
              }),
            },
          });
          return true;
        });
        if (cancelled) expired++;
      }
      if (expired)
        this.logger.log(`Released ${expired} expired checkout hold(s)`);
      return { expired };
    } finally {
      this.running = false;
    }
  }
}
