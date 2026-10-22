import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { text, number, choice, PHOTO_KINDS, FLEET_ROLES } from '../common/validation';
import { rentalPeriod, overlappingReservations } from '../bookings/availability';
import { rentalQuote } from '../bookings/pricing';
import { rentalPolicy } from '../bookings/rental-policy';
import {
  bookableVehicleWhere,
  flagUpcomingBookings,
  isAdministrativeRestriction,
  legacyVehicleStatus,
  vehicleEligibility,
  AVAILABILITY_STATES,
} from './vehicle-status';
@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) {}
  findAll(query: any) {
    // Public listing: approved + active + compliant today, or through the return date when dates are given.
    let where: any = bookableVehicleWhere(new Date());
    if (query.startDate !== undefined || query.endDate !== undefined) {
      const { start, end } = rentalPeriod(query.startDate, query.endDate);
      where = bookableVehicleWhere(end);
      where.bookings = { none: overlappingReservations(start, end) };
      where.availabilityBlocks = { none: { releasedAt: null, startDate: { lt: end }, endDate: { gt: start } } };
    }
    if (query.city && query.city !== 'All') where.locationCity = text(query.city, 'City');
    if (query.search) where.OR = ['make','model'].map(k => ({ [k]: { contains: text(query.search, 'Search') } }));
    if (query.category) where.category = text(query.category, 'Category');
    if (query.transmission) where.transmission = text(query.transmission, 'Transmission');
    if (query.seats) where.seats = number(query.seats, 'Seats', 2, 12, true);
    if (query.maxPrice) where.pricePerDay = { lte: number(query.maxPrice, 'Price', 1, 1000000) };
    return this.prisma.vehicle.findMany({ where, include: { media: { where: { kind: { in: [...PHOTO_KINDS] } }, select: { id: true, kind: true } }, reviews: { select: { rating: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
  }
  async findOne(id: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, ...bookableVehicleWhere(new Date()) },
      include: {
        media: {
          where: { kind: { in: [...PHOTO_KINDS] } },
          select: { id: true, kind: true },
        },
        reviews: {
          include: { author: { select: { firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return vehicle;
  }
  async quote(id: string, query: any) {
    const { start, end } = rentalPeriod(query.startDate, query.endDate);
    const car = await this.findOne(id);
    const conflict = await this.prisma.booking.findFirst({ where: { vehicleId: id, ...overlappingReservations(start, end) } as any });
    const block = await this.prisma.availabilityBlock.findFirst({ where: { vehicleId: id, releasedAt: null, startDate: { lt: end }, endDate: { gt: start } } });
    if (conflict || block) throw new ConflictException('This car is unavailable for the selected dates');
    if (
      !(await this.prisma.vehicle.findFirst({
        where: { id, ...bookableVehicleWhere(end) },
        select: { id: true },
      }))
    )
      throw new ConflictException(
        'Vehicle compliance is not valid through your return date',
      );
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
  // Owner fleet view, with the reasons each car can or cannot take bookings today.
  async mine(hostId: string) {
    const vehicles = await this.prisma.vehicle.findMany({
      where: { hostId },
      include: { media: { select: { id: true, kind: true } }, documents: true },
      orderBy: { createdAt: 'desc' },
    });
    return vehicles.map((v) => ({ ...v, eligibility: vehicleEligibility(v) }));
  }
  // Owner submits a draft or rejected listing for review. Requires the registration number and all eight photo angles.
  async submit(actorId: string, vehicleId: string) {
    const access = await this.managementScope(actorId, vehicleId);
    return this.prisma.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.findFirst({
        where: access,
        include: { media: true },
      });
      if (!vehicle) throw new NotFoundException('Your vehicle was not found');
      if (!['DRAFT', 'REJECTED'].includes(vehicle.approvalStatus))
        throw new BadRequestException(
          `A ${vehicle.approvalStatus.replace('_', ' ').toLowerCase()} listing cannot be submitted again`,
        );
      if (
        !vehicle.registrationNumber ||
        !PHOTO_KINDS.every((kind) => vehicle.media.some((m) => m.kind === kind))
      )
        throw new BadRequestException(
          'Add the registration number and all eight photo angles before submitting',
        );
      const changed = await tx.vehicle.updateMany({
        where: { id: vehicleId, approvalStatus: vehicle.approvalStatus },
        data: {
          approvalStatus: 'PENDING_APPROVAL',
          rejectedReason: null,
          status: legacyVehicleStatus(
            'PENDING_APPROVAL',
            vehicle.availability,
            vehicle.availabilityReason,
          ),
        },
      });
      if (changed.count !== 1)
        throw new ConflictException('Vehicle changed. Refresh and retry.');
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'VEHICLE_SUBMITTED',
          targetId: vehicleId,
          detail: JSON.stringify({
            from: vehicle.approvalStatus,
            to: 'PENDING_APPROVAL',
          }),
        },
      });
      return tx.vehicle.findUniqueOrThrow({ where: { id: vehicleId } });
    });
  }
  // Availability is separate from approval. Pausing never cancels or changes existing bookings (upcoming ones are
  // flagged for review), and reactivation never bypasses approval or compliance.
  // Owners act on their own cars: they may pause, and reactivate a car they paused themselves, but never clear an
  // administrative restriction (ADMIN_SUSPENDED, MAINTENANCE, REVIEW_REQUIRED). Administrators set and clear
  // restrictions on other owners' cars; on a car they own themselves they act as its owner, so another administrator
  // must lift a restriction on it.
  async setAvailability(
    actorId: string,
    vehicleId: string,
    body: { availability?: unknown; reason?: unknown },
  ) {
    const availability = choice(
      body.availability,
      'Availability',
      AVAILABILITY_STATES,
    );
    const actor = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { role: true },
    });
    const access = await this.managementScope(actorId, vehicleId);
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.vehicle.updateMany({
        where: access,
        data: { updatedAt: new Date() },
      });
      if (!locked.count)
        throw new NotFoundException('Your vehicle was not found');
      const vehicle = await tx.vehicle.findUniqueOrThrow({
        where: { id: vehicleId },
        include: { documents: true },
      });
      const asAdmin = actor?.role === 'ADMIN' && vehicle.hostId !== actorId;
      const restricted = isAdministrativeRestriction(
        vehicle.availabilityReason,
      );
      const reason =
        availability === 'ACTIVE'
          ? null
          : asAdmin
            ? choice(body.reason ?? 'ADMIN_SUSPENDED', 'Reason', [
                'ADMIN_SUSPENDED',
                'MAINTENANCE',
              ])
            : 'OWNER_PAUSED';
      // An owner's pause never replaces an administrative restriction (that would let the owner lift it later).
      if (
        !asAdmin &&
        availability === 'INACTIVE' &&
        vehicle.availability === 'INACTIVE' &&
        restricted
      )
        return { ...vehicle, flaggedBookings: 0 };
      if (!asAdmin && availability === 'ACTIVE' && restricted)
        throw new ForbiddenException({
          message: 'Only a Safar administrator can lift this restriction.',
          reasons: ['RESTRICTED_' + vehicle.availabilityReason],
        });
      if (
        vehicle.availability === availability &&
        vehicle.availabilityReason === reason
      )
        return { ...vehicle, flaggedBookings: 0 };
      if (availability === 'ACTIVE') {
        // Reactivation re-checks approval and current compliance; a rejected or pending car can never be made bookable here.
        const { bookable, reasons } = vehicleEligibility({
          ...vehicle,
          availability: 'ACTIVE',
        });
        if (!bookable)
          throw new BadRequestException({
            message:
              'This car cannot accept bookings until it is approved and its RC, Insurance and PUC are valid.',
            reasons,
          });
      }
      await tx.vehicle.update({
        where: { id: vehicleId },
        data: {
          availability,
          availabilityReason: reason,
          status: legacyVehicleStatus(
            vehicle.approvalStatus,
            availability,
            reason,
          ),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'VEHICLE_AVAILABILITY_CHANGED',
          targetId: vehicleId,
          detail: JSON.stringify({
            from: vehicle.availability,
            to: availability,
            reason,
            previousReason: vehicle.availabilityReason,
            capacity: asAdmin ? 'ADMIN' : 'OWNER',
          }),
        },
      });
      const flaggedBookings =
        availability === 'INACTIVE'
          ? await flagUpcomingBookings(
              tx,
              vehicleId,
              'VEHICLE_INACTIVE',
              actorId,
            )
          : 0;
      return {
        ...(await tx.vehicle.findUniqueOrThrow({ where: { id: vehicleId } })),
        flaggedBookings,
      };
    });
  }
  async create(hostId: string, data: any) {
    const user = await this.prisma.user.findUnique({ where: { id: hostId } });
    if (!user || !FLEET_ROLES.includes(user.role as any)) throw new ForbiddenException('Register a host or dealer account to list a car');
    const details = await this.listingDetails(data);
    const ids = data.mediaIds;
    if (!Array.isArray(ids) || ids.length !== PHOTO_KINDS.length || new Set(ids).size !== ids.length || ids.some(v => typeof v !== 'string')) throw new BadRequestException('Upload all eight required photo views');
    return this.prisma.$transaction(async tx => {
      const photos = await tx.media.findMany({ where: { id: { in: ids }, ownerId: hostId, vehicleId: null } });
      if (!PHOTO_KINDS.every(kind => photos.some(p => p.kind === kind))) throw new BadRequestException('Missing required photo views or invalid photo ownership');
      if (new Set(photos.map(photo => photo.sha256)).size !== PHOTO_KINDS.length) throw new BadRequestException('Use a different photo for each vehicle angle. RC documents belong in the document upload section.');
      // Submitted for review with the full photo set; inactive until the owner (or an admin) activates it after approval.
      const vehicle = await tx.vehicle.create({
        data: {
          hostId,
          ...details,
          images: JSON.stringify(photos.map((p) => '/api/media/' + p.id)),
          approvalStatus: 'PENDING_APPROVAL',
          availability: 'INACTIVE',
          status: 'PENDING_APPROVAL',
        },
      });
      const linked = await tx.media.updateMany({ where: { id: { in: ids }, ownerId: hostId, vehicleId: null }, data: { vehicleId: vehicle.id } });
      if (linked.count !== PHOTO_KINDS.length) throw new BadRequestException('Photos already used');
      return vehicle;
    });
  }
  // Administrator fleet entry. Same validation as host listings, but photos may follow later. The car starts as
  // PENDING_APPROVAL with no photos or documents invented on its behalf; it can only become ACTIVE through the normal
  // review (all eight real photos, RC/Insurance/PUC approved from evidence) by a different administrator.
  async createByAdmin(adminId: string, data: any, externalImageUrl: string | null) {
    const details = await this.listingDetails(data);
    const ids = data.mediaIds === undefined ? [] : data.mediaIds;
    if (!Array.isArray(ids) || ids.length > PHOTO_KINDS.length || new Set(ids).size !== ids.length || ids.some(v => typeof v !== 'string')) throw new BadRequestException('Photos must be a list of up to eight uploaded photo ids');
    return this.prisma.$transaction(async tx => {
      const photos = await this.validPhotos(tx, adminId, ids, []);
      // A complete photo set is submitted for review; otherwise the listing stays a DRAFT until the photos are added.
      const approvalStatus =
        photos.length === PHOTO_KINDS.length ? 'PENDING_APPROVAL' : 'DRAFT';
      const vehicle = await tx.vehicle.create({
        data: {
          hostId: adminId,
          ...details,
          images: '[]',
          approvalStatus,
          availability: 'INACTIVE',
          status: 'PENDING_APPROVAL',
        },
      });
      if (photos.length) {
        const linked = await tx.media.updateMany({ where: { id: { in: ids }, ownerId: adminId, vehicleId: null }, data: { vehicleId: vehicle.id } });
        if (linked.count !== photos.length) throw new BadRequestException('Photos already used');
      }
      const images = JSON.stringify([...this.orderedPhotoUrls(photos), ...(externalImageUrl ? [externalImageUrl] : [])]);
      const created = await tx.vehicle.update({ where: { id: vehicle.id }, data: { images } });
      await tx.auditLog.create({ data: { actorId: adminId, action: 'VEHICLE_CREATED_BY_ADMIN', targetId: vehicle.id, detail: JSON.stringify({ make: details.make, model: details.model, registrationNumber: details.registrationNumber, pricePerDay: details.pricePerDay, photoKinds: photos.map(p => p.kind), status: 'PENDING_APPROVAL', approvalStatus }) } });
      return created;
    });
  }
  // Completes the photo set of a listing that is still awaiting approval. Existing angles are never replaced, so
  // reviewed photos cannot be swapped after the fact; approved listings must be re-submitted through review instead.
  async addPhotos(actorId: string, vehicleId: string, data: any) {
    const ids = data.mediaIds;
    if (!Array.isArray(ids) || !ids.length || ids.length > PHOTO_KINDS.length || new Set(ids).size !== ids.length || ids.some(v => typeof v !== 'string')) throw new BadRequestException('Choose one or more uploaded photos');
    const access = await this.managementScope(actorId, vehicleId);
    return this.prisma.$transaction(async tx => {
      const locked = await tx.vehicle.updateMany({ where: access, data: { updatedAt: new Date() } });
      if (!locked.count)
        throw new NotFoundException('Your vehicle was not found');
      const vehicle = await tx.vehicle.findUniqueOrThrow({ where: { id: vehicleId }, include: { media: true } });
      if (!['DRAFT', 'PENDING_APPROVAL', 'REJECTED'].includes(vehicle.approvalStatus)) throw new BadRequestException('Photos can only be added while the listing is awaiting approval');
      const existing = vehicle.media.filter(m => (PHOTO_KINDS as readonly string[]).includes(m.kind));
      const photos = await this.validPhotos(tx, actorId, ids, existing);
      const linked = await tx.media.updateMany({ where: { id: { in: ids }, ownerId: actorId, vehicleId: null }, data: { vehicleId } });
      if (linked.count !== photos.length) throw new BadRequestException('Photos already used');
      const external = JSON.parse(vehicle.images || '[]').filter((url: unknown) => typeof url === 'string' && url.startsWith('https://'));
      const updated = await tx.vehicle.update({ where: { id: vehicleId }, data: { images: JSON.stringify([...this.orderedPhotoUrls([...existing, ...photos]), ...external]) }, include: { media: { select: { id: true, kind: true } } } });
      await tx.auditLog.create({ data: { actorId, action: 'VEHICLE_PHOTOS_ADDED', targetId: vehicleId, detail: JSON.stringify({ kinds: photos.map(p => p.kind) }) } });
      // A draft with the full photo set is submitted for review automatically.
      if (
        vehicle.approvalStatus === 'DRAFT' &&
        vehicle.registrationNumber &&
        updated.media.filter((m) =>
          (PHOTO_KINDS as readonly string[]).includes(m.kind),
        ).length === PHOTO_KINDS.length
      ) {
        await tx.vehicle.update({
          where: { id: vehicleId },
          data: {
            approvalStatus: 'PENDING_APPROVAL',
            status: legacyVehicleStatus(
              'PENDING_APPROVAL',
              vehicle.availability,
              vehicle.availabilityReason,
            ),
          },
        });
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'VEHICLE_SUBMITTED',
            targetId: vehicleId,
            detail: JSON.stringify({
              from: 'DRAFT',
              to: 'PENDING_APPROVAL',
              automatic: true,
            }),
          },
        });
        return tx.vehicle.findUniqueOrThrow({
          where: { id: vehicleId },
          include: { media: { select: { id: true, kind: true } } },
        });
      }
      return updated;
    });
  }
  // Uploaded, unlinked photo media owned by the actor: one per angle, no angle already on the car, no duplicate image.
  private async validPhotos(tx: any, ownerId: string, ids: string[], existing: { kind: string; sha256: string }[]) {
    if (!ids.length) return [];
    const photos = await tx.media.findMany({ where: { id: { in: ids }, ownerId, vehicleId: null } });
    if (photos.length !== ids.length || photos.some((p: any) => !(PHOTO_KINDS as readonly string[]).includes(p.kind))) throw new BadRequestException('Use your own unlinked vehicle photos (front, rear, sides, interior, boot, bonnet, odometer)');
    const kinds = [...existing.map(m => m.kind), ...photos.map((p: any) => p.kind)];
    if (new Set(kinds).size !== kinds.length) throw new BadRequestException('Each photo angle can only be added once');
    const hashes = [...existing.map(m => m.sha256), ...photos.map((p: any) => p.sha256)];
    if (new Set(hashes).size !== hashes.length) throw new BadRequestException('Use a different photo for each vehicle angle');
    return photos as { id: string; kind: string; sha256: string }[];
  }
  private orderedPhotoUrls(photos: { id: string; kind: string }[]) {
    return PHOTO_KINDS.flatMap(kind => photos.filter(p => p.kind === kind).map(p => '/api/media/' + p.id));
  }
  // Listing fields shared by host and administrator creation, so both paths store identical values.
  private async listingDetails(data: any) {
    const registrationNumber = text(data.registrationNumber, 'Registration number', 16).replace(/\s/g, '').toUpperCase();
    if (!/^[A-Z0-9-]{6,16}$/.test(registrationNumber)) throw new BadRequestException('Invalid registration number');
    if (await this.prisma.vehicle.findUnique({ where: { registrationNumber } })) throw new ConflictException('This registration number is already listed. Open My Fleet or contact an administrator.');
    const pricePerDay = number(data.pricePerDay, 'Daily rate', 1, 1000000);
    if (Math.round(pricePerDay * 100) !== pricePerDay * 100) throw new BadRequestException('Use at most two decimal places');
    return {
      registrationNumber, make: text(data.make, 'Make'), model: text(data.model, 'Model'),
      year: number(data.year, 'Year', 1990, new Date().getFullYear() + 1, true),
      category: choice(data.category, 'Category', ['Hatchback', 'Sedan', 'Compact SUV', 'SUV', 'MUV', 'Luxury']),
      transmission: choice(data.transmission, 'Transmission', ['Manual', 'Automatic']),
      fuelType: choice(data.fuelType, 'Fuel', ['Petrol', 'Diesel', 'Electric', 'CNG', 'Hybrid']),
      seats: number(data.seats, 'Seats', 2, 12, true), pricePerDay,
      odometer: number(data.odometer, 'Odometer', 0, 2000000, true),
      locationCity: text(data.locationCity ?? data.city, 'City'),
    };
  }
}
