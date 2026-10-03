import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'node:crypto';
import { text, number, choice } from '../common/validation';
import { rentalPeriod, overlappingReservations } from './availability';
import { rentalQuote } from './pricing';

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}
  async create(customerId: string, data: any) {
    const vehicleId = text(data.vehicleId, 'Vehicle');
    const requestKey = customerId + ':' + text(data.requestKey, 'Request key', 80);
    const { start, end } = rentalPeriod(data.startDate, data.endDate);
    return this.prisma.$transaction(async tx => {
      const previous = await tx.booking.findUnique({ where: { requestKey }, include: { vehicle: true, payment: true, invoice: true } });
      if (previous) {
        if (previous.vehicleId !== vehicleId || +previous.startDate !== +start || +previous.endDate !== +end) throw new ConflictException('Request key already used for another booking');
        return previous;
      }
      const user = await tx.user.findUnique({ where: { id: customerId } });
      if (!user?.isVerified || !user.dlValidUntil || user.dlValidUntil < end) throw new ForbiddenException('Complete KYC and obtain DL approval valid through your return date');
      // Lock before reading the price and status so admin changes cannot create stale quotes.
      const locked = await tx.vehicle.updateMany({ where: { id: vehicleId }, data: { updatedAt: new Date() } });
      if (!locked.count) throw new NotFoundException('Car is not available');
      const car = await tx.vehicle.findUnique({ where: { id: vehicleId } });
      if (!car || car.status !== 'ACTIVE') throw new NotFoundException('Car is not available');
      if (car.hostId === customerId) throw new BadRequestException('You cannot book your own car');
      const docs = await tx.document.findMany({ where: { vehicleId, status: 'APPROVED', kind: { in: ['RC', 'INSURANCE', 'PUC'] }, validUntil: { gte: end } } });
      if (!['RC', 'INSURANCE', 'PUC'].every(k => docs.some(d => d.kind === k))) throw new BadRequestException('Vehicle documents must remain valid through your return date');
      // Serialize changes on this car before checking availability. Works with SQLite's write lock
      // and also becomes a row lock when migrated to PostgreSQL.
      await tx.vehicle.update({ where: { id: vehicleId }, data: { updatedAt: new Date() } });
      const conflict = await tx.booking.findFirst({ where: { vehicleId, ...overlappingReservations(start, end) } as any });
      if (conflict) throw new ConflictException('Car is already reserved for these dates');
      const blocked = await tx.availabilityBlock.findFirst({ where: { vehicleId, releasedAt: null, startDate: { lt: end }, endDate: { gt: start } } });
      if (blocked) throw new ConflictException('The host has blocked this car for the selected dates');
      const { rentalDays, totalAmount, includedKilometres, securityDeposit } = rentalQuote(car.pricePerDay, start, end);
      if (data.expectedTotal !== undefined && Number(data.expectedTotal) !== totalAmount) throw new ConflictException('The rental price changed. Refresh your quote before booking.');
      return tx.booking.create({ data: { customerId, vehicleId, requestKey, startDate: start, endDate: end, rentalDays, dailyRate: car.pricePerDay, totalAmount, includedKilometres, securityDeposit,
        bookingRef: 'SF-' + randomUUID().toUpperCase(), status: 'PENDING', expiresAt: new Date(Math.min(Date.now() + 30 * 60000, +start)) },
        include: { vehicle: true, payment: true, invoice: true } });
    }, { timeout: 10000 });
  }
  getMyTrips(customerId: string) {
    return this.prisma.booking.findMany({ where: { customerId }, include: { vehicle: true, payment: true, invoice: true, inspections: true }, orderBy: { createdAt: 'desc' }, take: 200 });
  }
  getHostBookings(hostId: string) {
    return this.prisma.booking.findMany({ where: { vehicle: { hostId } }, include: { vehicle: true, customer: { select: { firstName: true, lastName: true } }, payment: true, inspections: true }, orderBy: { createdAt: 'desc' }, take: 200 });
  }
  async cancel(userId: string, id: string) {
    return this.prisma.$transaction(async tx => {
      const booking = await tx.booking.findUnique({ where: { id }, include: { vehicle: true } });
      if (!booking) throw new NotFoundException('Booking not found');
      if (booking.customerId !== userId && booking.vehicle.hostId !== userId) throw new ForbiddenException('Booking access denied');
      if (!['PENDING', 'CONFIRMED'].includes(booking.status) || booking.startDate <= new Date()) throw new BadRequestException('Cancellation is only available before pickup');
      const changed = await tx.booking.updateMany({ where: { id, status: booking.status }, data: { status: 'CANCELLED' } });
      if (changed.count !== 1) throw new ConflictException('Booking changed; refresh and retry');
      await tx.payment.updateMany({ where: { bookingId: id, status: 'SUCCESS' }, data: { status: 'REFUND_PENDING' } });
      await tx.invoice.updateMany({ where: { bookingId: id }, data: { status: 'REFUND_PENDING' } });
      await tx.auditLog.create({ data: { actorId: userId, action: 'BOOKING_CANCELLED', targetId: id, detail: 'External refunds require administrator reconciliation' } });
      return { id, status: 'CANCELLED' };
    });
  }
  async inspect(user: any, id: string, body: any) {
    const stage = choice(body.stage, 'Inspection stage', ['PICKUP', 'RETURN']);
    const odometer = number(body.odometer, 'Odometer', 0, 2000000, true);
    const mediaId = text(body.mediaId, 'Odometer photo');
    const fuelPercent = number(body.fuelPercent, 'Fuel level (%)', 0, 100, true);
    const damageNote = text(body.damageNote, 'Vehicle condition', 2000);
    return this.prisma.$transaction(async tx => {
      const booking = await tx.booking.findUnique({ where: { id }, include: { vehicle: true, inspections: true } });
      if (!booking) throw new NotFoundException('Booking not found');
      if (booking.vehicle.hostId !== user.id && user.role !== 'ADMIN') throw new ForbiddenException('Host or administrator required');
      if (stage === 'PICKUP' && (booking.status !== 'CONFIRMED' || booking.startDate > new Date() || booking.endDate <= new Date())) throw new BadRequestException('Pickup is available during the confirmed rental period');
      if (stage === 'RETURN' && booking.status !== 'ACTIVE') throw new BadRequestException('Only active trips can be returned');
      const minimum = stage === 'RETURN' ? booking.inspections.find(i => i.stage === 'PICKUP')?.odometer : booking.vehicle.odometer;
      if (minimum === undefined || odometer < minimum) throw new BadRequestException('Odometer cannot decrease');
      const media = await tx.media.findFirst({ where: { id: mediaId, ownerId: user.id, kind: 'ODOMETER', vehicleId: null } });
      if (!media) throw new BadRequestException('Upload a new odometer photo');
      if (await tx.inspection.findFirst({ where: { mediaId } })) throw new BadRequestException('Photo already used');
      const updated = await tx.booking.updateMany({ where: { id, status: booking.status }, data: { status: stage === 'PICKUP' ? 'ACTIVE' : 'COMPLETED' } });
      if (updated.count !== 1) throw new ConflictException('Trip changed');
      await tx.inspection.create({ data: { bookingId: id, stage, odometer, mediaId, fuelPercent, damageNote, note: body.note ? text(body.note, 'Inspection note', 1000) : null } });
      await tx.vehicle.update({ where: { id: booking.vehicleId }, data: { odometer } });
      await tx.auditLog.create({ data: { actorId: user.id, action: stage, targetId: id, detail: 'Odometer ' + odometer } });
      return { message: stage === 'PICKUP' ? 'Trip started' : 'Trip completed' };
    });
  }
}
