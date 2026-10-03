import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { text, number, choice, PHOTO_KINDS } from '../common/validation';
import { rentalPeriod, overlappingReservations } from '../bookings/availability';
import { rentalQuote } from '../bookings/pricing';
@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) {}
  findAll(query: any) {
    const where: any = { status: 'ACTIVE' };
    if (query.startDate !== undefined || query.endDate !== undefined) {
      const { start, end } = rentalPeriod(query.startDate, query.endDate);
      where.bookings = { none: overlappingReservations(start, end) };
      where.availabilityBlocks = { none: { releasedAt: null, startDate: { lt: end }, endDate: { gt: start } } };
      where.AND = ['RC', 'INSURANCE', 'PUC'].map(kind => ({ documents: { some: { kind, status: 'APPROVED', validUntil: { gte: end } } } }));
    }
    if (query.city && query.city !== 'All') where.locationCity = text(query.city, 'City');
    if (query.search) where.OR = ['make','model'].map(k => ({ [k]: { contains: text(query.search, 'Search') } }));
    if (query.category) where.category = text(query.category, 'Category');
    if (query.transmission) where.transmission = text(query.transmission, 'Transmission');
    if (query.seats) where.seats = number(query.seats, 'Seats', 2, 12, true);
    if (query.maxPrice) where.pricePerDay = { lte: number(query.maxPrice, 'Price', 1, 1000000) };
    return this.prisma.vehicle.findMany({ where, include: { media: { where: { kind: { in: [...PHOTO_KINDS] } }, select: { id: true, kind: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
  }
  async findOne(id: string) {
    const vehicle = await this.prisma.vehicle.findFirst({ where: { id, status: 'ACTIVE' }, include: { media: { where: { kind: { in: [...PHOTO_KINDS] } }, select: { id: true, kind: true } } } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return vehicle;
  }
  async quote(id: string, query: any) {
    const { start, end } = rentalPeriod(query.startDate, query.endDate);
    const car = await this.findOne(id);
    const conflict = await this.prisma.booking.findFirst({ where: { vehicleId: id, ...overlappingReservations(start, end) } as any });
    const block = await this.prisma.availabilityBlock.findFirst({ where: { vehicleId: id, releasedAt: null, startDate: { lt: end }, endDate: { gt: start } } });
    if (conflict || block) throw new ConflictException('This car is unavailable for the selected dates');
    const documents = await this.prisma.document.findMany({ where: { vehicleId: id, status: 'APPROVED', validUntil: { gte: end } } });
    if (!['RC','INSURANCE','PUC'].every(kind => documents.some(d => d.kind === kind))) throw new ConflictException('Vehicle compliance is not valid through your return date');
    return { vehicleId: id, startDate: start.toISOString(), endDate: end.toISOString(), ...rentalQuote(car.pricePerDay, start, end) };
  }
  async schedule(hostId: string, id: string) {
    const access = await this.managementScope(hostId, id);
    if (!await this.prisma.vehicle.findFirst({ where: access })) throw new NotFoundException('Your vehicle was not found');
    const now = new Date();
    const [blocks, bookings] = await Promise.all([
      this.prisma.availabilityBlock.findMany({ where: { vehicleId: id, releasedAt: null, endDate: { gt: now } }, orderBy: { startDate: 'asc' } }),
      this.prisma.booking.findMany({ where: { vehicleId: id, endDate: { gt: now }, OR: [{ status: { in: ['CONFIRMED','ACTIVE'] } }, { status: 'PENDING', expiresAt: { gt: now } }] }, select: { id: true, bookingRef: true, startDate: true, endDate: true, status: true }, orderBy: { startDate: 'asc' } }),
    ]);
    return { blocks, bookings };
  }
  async block(hostId: string, id: string, body: any) {
    const access = await this.managementScope(hostId, id);
    const { start, end } = rentalPeriod(body.startDate, body.endDate);
    const reason = text(body.reason, 'Reason', 300);
    return this.prisma.$transaction(async tx => {
      const owned = await tx.vehicle.updateMany({ where: access, data: { updatedAt: new Date() } });
      if (!owned.count) throw new NotFoundException('Your vehicle was not found');
      const conflict = await tx.booking.findFirst({ where: { vehicleId: id, ...overlappingReservations(start, end) } as any });
      if (conflict) throw new ConflictException('An existing booking or checkout hold overlaps these dates');
      const existing = await tx.availabilityBlock.findFirst({ where: { vehicleId: id, releasedAt: null, startDate: { lt: end }, endDate: { gt: start } } });
      if (existing) throw new ConflictException('These dates already overlap a blocked period');
      const block = await tx.availabilityBlock.create({ data: { vehicleId: id, startDate: start, endDate: end, reason } });
      await tx.auditLog.create({ data: { actorId: hostId, action: 'AVAILABILITY_BLOCKED', targetId: block.id, detail: reason } });
      return block;
    });
  }
  async releaseBlock(hostId: string, vehicleId: string, blockId: string) {
    const access = await this.managementScope(hostId, vehicleId);
    return this.prisma.$transaction(async tx => {
      if (!await tx.vehicle.findFirst({ where: access })) throw new NotFoundException('Your vehicle was not found');
      const changed = await tx.availabilityBlock.updateMany({ where: { id: blockId, vehicleId, releasedAt: null }, data: { releasedAt: new Date() } });
      if (!changed.count) throw new NotFoundException('Active availability block was not found');
      await tx.auditLog.create({ data: { actorId: hostId, action: 'AVAILABILITY_RELEASED', targetId: blockId, detail: 'Host reopened these dates' } });
      return { released: true };
    });
  }
  private async managementScope(actorId: string, id: string) {
    const actor = await this.prisma.user.findUnique({ where: { id: actorId }, select: { role: true } });
    return actor?.role === 'ADMIN' ? { id } : { id, hostId: actorId };
  }
  mine(hostId: string) { return this.prisma.vehicle.findMany({ where: { hostId }, include: { media: { select: { id: true, kind: true } }, documents: true }, orderBy: { createdAt: 'desc' } }); }
  async create(hostId: string, data: any) {
    const user = await this.prisma.user.findUnique({ where: { id: hostId } });
    if (!user || !['HOST', 'ADMIN'].includes(user.role)) throw new ForbiddenException('Register a host account to list a car');
    const registrationNumber = text(data.registrationNumber, 'Registration number', 16).replace(/\s/g, '').toUpperCase();
    if (!/^[A-Z0-9-]{6,16}$/.test(registrationNumber)) throw new BadRequestException('Invalid registration number');
    if (await this.prisma.vehicle.findUnique({ where: { registrationNumber } })) throw new ConflictException('This registration number is already listed. Open My Fleet or contact an administrator.');
    const ids = data.mediaIds;
    if (!Array.isArray(ids) || ids.length !== PHOTO_KINDS.length || new Set(ids).size !== ids.length || ids.some(v => typeof v !== 'string')) throw new BadRequestException('Upload all eight required photo views');
    const price = number(data.pricePerDay, 'Daily rate', 1, 1000000);
    if (Math.round(price * 100) !== price * 100) throw new BadRequestException('Use at most two decimal places');
    return this.prisma.$transaction(async tx => {
      const photos = await tx.media.findMany({ where: { id: { in: ids }, ownerId: hostId, vehicleId: null } });
      if (!PHOTO_KINDS.every(kind => photos.some(p => p.kind === kind))) throw new BadRequestException('Missing required photo views or invalid photo ownership');
      if (new Set(photos.map(photo => photo.sha256)).size !== PHOTO_KINDS.length) throw new BadRequestException('Use a different photo for each vehicle angle. RC documents belong in the document upload section.');
      const vehicle = await tx.vehicle.create({ data: {
        hostId, registrationNumber, make: text(data.make, 'Make'), model: text(data.model, 'Model'),
        year: number(data.year, 'Year', 1990, new Date().getFullYear() + 1, true),
        category: choice(data.category, 'Category', ['Hatchback', 'Sedan', 'Compact SUV', 'SUV', 'MUV', 'Luxury']),
        transmission: choice(data.transmission, 'Transmission', ['Manual', 'Automatic']),
        fuelType: choice(data.fuelType, 'Fuel', ['Petrol', 'Diesel', 'Electric', 'CNG', 'Hybrid']),
        seats: number(data.seats, 'Seats', 2, 12, true), pricePerDay: price,
        odometer: number(data.odometer, 'Odometer', 0, 2000000, true),
        locationCity: text(data.locationCity, 'City'), images: JSON.stringify(photos.map(p => '/api/media/' + p.id)),
        status: 'PENDING_APPROVAL',
      } });
      const linked = await tx.media.updateMany({ where: { id: { in: ids }, ownerId: hostId, vehicleId: null }, data: { vehicleId: vehicle.id } });
      if (linked.count !== PHOTO_KINDS.length) throw new BadRequestException('Photos already used');
      return vehicle;
    });
  }
}
