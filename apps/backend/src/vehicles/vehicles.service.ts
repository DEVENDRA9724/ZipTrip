import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { text, number, choice, PHOTO_KINDS, FLEET_ROLES } from '../common/validation';
import { rentalPeriod, overlappingReservations } from '../bookings/availability';
import { rentalQuote } from '../bookings/pricing';
import { rentalPolicy } from '../bookings/rental-policy';
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
    return this.prisma.vehicle.findMany({ where, include: { media: { where: { kind: { in: [...PHOTO_KINDS] } }, select: { id: true, kind: true } }, reviews: { select: { rating: true } } }, orderBy: { createdAt: 'asc' }, take: 100 });
  }
  async findOne(id: string) {
    const vehicle = await this.prisma.vehicle.findFirst({ where: { id, status: 'ACTIVE' }, include: { media: { where: { kind: { in: [...PHOTO_KINDS] } }, select: { id: true, kind: true } }, reviews: { include: { author: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' }, take: 20 } } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return vehicle;
  }
  async quote(id: string, query: any) {
    const { start, end } = rentalPeriod(query.startDate, query.endDate);
    const car = await this.findOne(id);
    const conflict = await this.prisma.booking.findFirst({ where: { vehicleId: id, ...overlappingReservations(start, end) } as any });
    const block = await this.prisma.availabilityBlock.findFirst({ where: { vehicleId: id, releasedAt: null, startDate: { lt: end }, endDate: { gt: start } } });
    if (conflict || block) throw new ConflictException('This car is already reserved for the selected dates. Please pick another date range.');
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
  async hostAgreement(user: any, id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
      include: {
        host: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        documents: { select: { kind: true, status: true, validUntil: true } },
      },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    if (vehicle.hostId !== user.id && user.role !== 'ADMIN') throw new ForbiddenException('Host agreement access denied');
    return {
      agreementVersion: 'safar-host-partner-v1',
      generatedAt: new Date().toISOString(),
      business: { name: process.env.BUSINESS_NAME || 'Safar Self Drive', address: process.env.BUSINESS_ADDRESS || '', email: process.env.BUSINESS_EMAIL || '', phone: process.env.BUSINESS_PHONE || '' },
      host: vehicle.host,
      vehicle: { id: vehicle.id, make: vehicle.make, model: vehicle.model, year: vehicle.year, registrationNumber: vehicle.registrationNumber, city: vehicle.locationCity, status: vehicle.status, dailyRate: Number(vehicle.pricePerDay) },
      commercialTerms: { platformRole: 'Safar operates the marketplace, verification, booking records and customer support.', hostPayout: 'Payout is released only after a completed booking, inspection and reconciliation under the selected payment provider terms.', securityDeposit: rentalPolicy.deposit, includedKilometresPer24Hours: rentalPolicy.kilometresPer24Hours, excessKmRate: rentalPolicy.excessKmRate },
      acknowledgement: await this.prisma.auditLog.findFirst({ where: { action: 'HOST_AGREEMENT_ACKNOWLEDGED', targetId: id, actorId: user.id }, orderBy: { createdAt: 'desc' } }).then(row => row ? { acceptedAt: row.createdAt, version: row.detail } : null),
      terms: [
        'The host confirms legal ownership or authority to list the vehicle and must keep registration, insurance and pollution documents valid.',
        'Safar may suspend the listing when documents expire, safety concerns are reported, a booking dispute is open or the vehicle fails inspection.',
        'The host must provide the vehicle clean, roadworthy, fuelled as recorded and with the required exterior, interior, boot, bonnet and odometer evidence.',
        'The host must accept pickup and return inspections, report accidents or damage promptly, and not collect unrecorded charges directly from a customer.',
        'Bookings, cancellations, refunds, deposits, excess distance, late return, damage and payout adjustments must be recorded through Safar operations.',
        'Safar may withhold or adjust a payout for documented damage, fraud, fines, chargebacks, customer refunds or breach of these terms after review.',
        'This partner agreement supplements each booking agreement and does not replace mandatory insurance, tax or statutory obligations.',
      ],
    };
  }
  async acknowledgeHostAgreement(user: any, id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id }, select: { hostId: true } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    if (vehicle.hostId !== user.id && user.role !== 'ADMIN') throw new ForbiddenException('Host agreement access denied');
    const detail = 'safar-host-partner-v1';
    const row = await this.prisma.auditLog.create({ data: { actorId: user.id, action: 'HOST_AGREEMENT_ACKNOWLEDGED', targetId: id, detail } });
    return { acceptedAt: row.createdAt, version: detail };
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
    if (!user) throw new ForbiddenException('User not found');
    if (!FLEET_ROLES.includes(user.role as any)) {
      await this.prisma.user.update({ where: { id: hostId }, data: { role: 'HOST' } });
    }
    const rawPlate = (data.registrationNumber || 'GJ01SF' + Math.floor(1000 + Math.random() * 9000)).toString().replace(/\s/g, '').toUpperCase();
    const registrationNumber = rawPlate.length >= 6 ? rawPlate.slice(0, 16) : ('GJ01SF' + Math.floor(1000 + Math.random() * 9000));
    if (await this.prisma.vehicle.findUnique({ where: { registrationNumber } })) {
      throw new ConflictException('This registration number is already listed.');
    }

    const price = Math.max(500, Number(data.pricePerDay || 2500));
    const make = String(data.make || 'Mahindra').trim();
    const model = String(data.model || 'Thar').trim();
    const modelLower = model.toLowerCase();
    const defaultPhoto = `/cars/${modelLower.includes('thar') ? 'thar' : modelLower.includes('creta') ? 'creta' : modelLower.includes('fortuner') ? 'fortuner' : modelLower.includes('innova') ? 'innova' : modelLower.includes('scorpio') ? 'scorpio' : modelLower.includes('bmw') ? 'bmw' : modelLower.includes('city') ? 'city' : 'swift'}.jpg`;

    let photoUrls = [defaultPhoto];
    const ids = data.mediaIds;
    if (Array.isArray(ids) && ids.length) {
      const photos = await this.prisma.media.findMany({ where: { id: { in: ids } } });
      if (photos.length) photoUrls = photos.map(p => '/api/media/' + p.id);
    } else if (data.imageUrl) {
      photoUrls = [data.imageUrl];
    }

    const category = ['Hatchback', 'Sedan', 'Compact SUV', 'SUV', 'MUV', 'Luxury', 'EV'].includes(data.category)
      ? data.category
      : 'SUV';

    const transmission = ['Manual', 'Automatic'].includes(data.transmission)
      ? data.transmission
      : 'Automatic';

    const fuelType = ['Petrol', 'Diesel', 'Electric', 'CNG', 'Hybrid'].includes(data.fuelType)
      ? data.fuelType
      : 'Diesel';

    const vehicle = await this.prisma.vehicle.create({
      data: {
        hostId,
        registrationNumber,
        make,
        model,
        year: Math.max(1990, Math.min(new Date().getFullYear() + 1, Number(data.year || 2024))),
        category,
        transmission,
        fuelType,
        seats: Math.max(2, Math.min(12, Number(data.seats || 5))),
        pricePerDay: price,
        extraKmCharge: Math.max(0, Number(data.extraKmCharge || 12)),
        securityDeposit: Math.max(0, Number(data.securityDeposit || 2000)),
        includedKilometresPerDay: 300,
        odometer: Math.max(0, Number(data.odometer || 12500)),
        locationCity: String(data.locationCity || 'Ahmedabad').trim(),
        images: JSON.stringify(photoUrls),
        status: 'ACTIVE',
      }
    });

    if (Array.isArray(ids) && ids.length) {
      await this.prisma.media.updateMany({
        where: { id: { in: ids }, ownerId: hostId, vehicleId: null },
        data: { vehicleId: vehicle.id }
      }).catch(() => {});
    }

    return vehicle;
  }

  async update(currentUser: any, id: string, data: any) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    if (currentUser.role !== 'ADMIN' && vehicle.hostId !== currentUser.id) {
      throw new ForbiddenException('You do not have permission to manage this vehicle');
    }
    const updateData: any = {};
    if (data.status) {
      const validStatuses = ['PENDING_APPROVAL', 'ACTIVE', 'INACTIVE', 'MAINTENANCE'];
      if (validStatuses.includes(data.status)) updateData.status = data.status;
    }
    if (data.pricePerDay !== undefined) {
      updateData.pricePerDay = Math.max(500, Number(data.pricePerDay));
    }
    if (data.extraKmCharge !== undefined) {
      updateData.extraKmCharge = Math.max(0, Number(data.extraKmCharge));
    }
    if (data.securityDeposit !== undefined) {
      updateData.securityDeposit = Math.max(0, Number(data.securityDeposit));
    }
    if (data.locationCity) {
      updateData.locationCity = String(data.locationCity).trim();
    }
    if (data.fuelLevelPercent !== undefined) {
      updateData.fuelLevelPercent = Math.min(100, Math.max(0, Number(data.fuelLevelPercent)));
    }
    if (data.odometer !== undefined) {
      updateData.odometer = Math.max(0, Number(data.odometer));
    }
    if (data.features !== undefined) {
      updateData.features = typeof data.features === 'string' ? data.features : JSON.stringify(data.features);
    }
    return this.prisma.vehicle.update({
      where: { id },
      data: updateData,
    });
  }
}
