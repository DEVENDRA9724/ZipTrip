"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VehiclesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const validation_1 = require("../common/validation");
const availability_1 = require("../bookings/availability");
const pricing_1 = require("../bookings/pricing");
const rental_policy_1 = require("../bookings/rental-policy");
const vehicle_status_1 = require("./vehicle-status");
let VehiclesService = class VehiclesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    findAll(query) {
        let where = (0, vehicle_status_1.bookableVehicleWhere)(new Date());
        if (query.startDate !== undefined || query.endDate !== undefined) {
            const { start, end } = (0, availability_1.rentalPeriod)(query.startDate, query.endDate);
            where = (0, vehicle_status_1.bookableVehicleWhere)(end);
            where.bookings = { none: (0, availability_1.overlappingReservations)(start, end) };
            where.availabilityBlocks = { none: { releasedAt: null, startDate: { lt: end }, endDate: { gt: start } } };
        }
        if (query.city && query.city !== 'All')
            where.locationCity = (0, validation_1.text)(query.city, 'City');
        if (query.search)
            where.OR = ['make', 'model'].map(k => ({ [k]: { contains: (0, validation_1.text)(query.search, 'Search') } }));
        if (query.category)
            where.category = (0, validation_1.text)(query.category, 'Category');
        if (query.transmission)
            where.transmission = (0, validation_1.text)(query.transmission, 'Transmission');
        if (query.seats)
            where.seats = (0, validation_1.number)(query.seats, 'Seats', 2, 12, true);
        if (query.maxPrice)
            where.pricePerDay = { lte: (0, validation_1.number)(query.maxPrice, 'Price', 1, 1000000) };
        return this.prisma.vehicle.findMany({ where, include: { media: { where: { kind: { in: [...validation_1.PHOTO_KINDS] } }, select: { id: true, kind: true } }, reviews: { select: { rating: true } } }, orderBy: { createdAt: 'asc' }, take: 100 });
    }
    async findOne(id) {
        const vehicle = await this.prisma.vehicle.findFirst({
            where: { id, ...(0, vehicle_status_1.bookableVehicleWhere)(new Date()) },
            include: {
                media: {
                    where: { kind: { in: [...validation_1.PHOTO_KINDS] } },
                    select: { id: true, kind: true },
                },
                reviews: {
                    include: { author: { select: { firstName: true, lastName: true } } },
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                },
            },
        });
        if (!vehicle)
            throw new common_1.NotFoundException('Vehicle not found');
        return vehicle;
    }
    async quote(id, query) {
        const { start, end } = (0, availability_1.rentalPeriod)(query.startDate, query.endDate);
        const car = await this.findOne(id);
        const conflict = await this.prisma.booking.findFirst({ where: { vehicleId: id, ...(0, availability_1.overlappingReservations)(start, end) } });
        const block = await this.prisma.availabilityBlock.findFirst({ where: { vehicleId: id, releasedAt: null, startDate: { lt: end }, endDate: { gt: start } } });
        if (conflict || block)
            throw new common_1.ConflictException('This car is unavailable for the selected dates');
        if (!(await this.prisma.vehicle.findFirst({
            where: { id, ...(0, vehicle_status_1.bookableVehicleWhere)(end) },
            select: { id: true },
        })))
            throw new common_1.ConflictException('Vehicle compliance is not valid through your return date');
        return { vehicleId: id, startDate: start.toISOString(), endDate: end.toISOString(), ...(0, pricing_1.rentalQuote)(car.pricePerDay, start, end) };
    }
    async schedule(hostId, id) {
        const access = await this.managementScope(hostId, id);
        if (!await this.prisma.vehicle.findFirst({ where: access }))
            throw new common_1.NotFoundException('Your vehicle was not found');
        const now = new Date();
        const [blocks, bookings] = await Promise.all([
            this.prisma.availabilityBlock.findMany({ where: { vehicleId: id, releasedAt: null, endDate: { gt: now } }, orderBy: { startDate: 'asc' } }),
            this.prisma.booking.findMany({ where: { vehicleId: id, endDate: { gt: now }, OR: [{ status: { in: ['CONFIRMED', 'ACTIVE'] } }, { status: 'PENDING', expiresAt: { gt: now } }] }, select: { id: true, bookingRef: true, startDate: true, endDate: true, status: true }, orderBy: { startDate: 'asc' } }),
        ]);
        return { blocks, bookings };
    }
    async hostAgreement(user, id) {
        const vehicle = await this.prisma.vehicle.findUnique({
            where: { id },
            include: {
                host: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
                documents: { select: { kind: true, status: true, validUntil: true } },
            },
        });
        if (!vehicle)
            throw new common_1.NotFoundException('Vehicle not found');
        if (vehicle.hostId !== user.id && user.role !== 'ADMIN')
            throw new common_1.ForbiddenException('Host agreement access denied');
        return {
            agreementVersion: 'safar-host-partner-v1',
            generatedAt: new Date().toISOString(),
            business: { name: process.env.BUSINESS_NAME || 'Safar Self Drive', address: process.env.BUSINESS_ADDRESS || '', email: process.env.BUSINESS_EMAIL || '', phone: process.env.BUSINESS_PHONE || '' },
            host: vehicle.host,
            vehicle: { id: vehicle.id, make: vehicle.make, model: vehicle.model, year: vehicle.year, registrationNumber: vehicle.registrationNumber, city: vehicle.locationCity, status: vehicle.status, dailyRate: Number(vehicle.pricePerDay) },
            commercialTerms: { platformRole: 'Safar operates the marketplace, verification, booking records and customer support.', hostPayout: 'Payout is released only after a completed booking, inspection and reconciliation under the selected payment provider terms.', securityDeposit: rental_policy_1.rentalPolicy.deposit, includedKilometresPer24Hours: rental_policy_1.rentalPolicy.kilometresPer24Hours, excessKmRate: rental_policy_1.rentalPolicy.excessKmRate },
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
    async acknowledgeHostAgreement(user, id) {
        const vehicle = await this.prisma.vehicle.findUnique({ where: { id }, select: { hostId: true } });
        if (!vehicle)
            throw new common_1.NotFoundException('Vehicle not found');
        if (vehicle.hostId !== user.id && user.role !== 'ADMIN')
            throw new common_1.ForbiddenException('Host agreement access denied');
        const detail = 'safar-host-partner-v1';
        const row = await this.prisma.auditLog.create({ data: { actorId: user.id, action: 'HOST_AGREEMENT_ACKNOWLEDGED', targetId: id, detail } });
        return { acceptedAt: row.createdAt, version: detail };
    }
    async block(hostId, id, body) {
        const access = await this.managementScope(hostId, id);
        const { start, end } = (0, availability_1.rentalPeriod)(body.startDate, body.endDate);
        const reason = (0, validation_1.text)(body.reason, 'Reason', 300);
        return this.prisma.$transaction(async (tx) => {
            const owned = await tx.vehicle.updateMany({ where: access, data: { updatedAt: new Date() } });
            if (!owned.count)
                throw new common_1.NotFoundException('Your vehicle was not found');
            const conflict = await tx.booking.findFirst({ where: { vehicleId: id, ...(0, availability_1.overlappingReservations)(start, end) } });
            if (conflict)
                throw new common_1.ConflictException('An existing booking or checkout hold overlaps these dates');
            const existing = await tx.availabilityBlock.findFirst({ where: { vehicleId: id, releasedAt: null, startDate: { lt: end }, endDate: { gt: start } } });
            if (existing)
                throw new common_1.ConflictException('These dates already overlap a blocked period');
            const block = await tx.availabilityBlock.create({ data: { vehicleId: id, startDate: start, endDate: end, reason } });
            await tx.auditLog.create({ data: { actorId: hostId, action: 'AVAILABILITY_BLOCKED', targetId: block.id, detail: reason } });
            return block;
        });
    }
    async releaseBlock(hostId, vehicleId, blockId) {
        const access = await this.managementScope(hostId, vehicleId);
        return this.prisma.$transaction(async (tx) => {
            if (!await tx.vehicle.findFirst({ where: access }))
                throw new common_1.NotFoundException('Your vehicle was not found');
            const changed = await tx.availabilityBlock.updateMany({ where: { id: blockId, vehicleId, releasedAt: null }, data: { releasedAt: new Date() } });
            if (!changed.count)
                throw new common_1.NotFoundException('Active availability block was not found');
            await tx.auditLog.create({ data: { actorId: hostId, action: 'AVAILABILITY_RELEASED', targetId: blockId, detail: 'Host reopened these dates' } });
            return { released: true };
        });
    }
    async managementScope(actorId, id) {
        const actor = await this.prisma.user.findUnique({ where: { id: actorId }, select: { role: true } });
        return actor?.role === 'ADMIN' ? { id } : { id, hostId: actorId };
    }
    async mine(hostId) {
        const vehicles = await this.prisma.vehicle.findMany({
            where: { hostId },
            include: { media: { select: { id: true, kind: true } }, documents: true },
            orderBy: { createdAt: 'desc' },
        });
        return vehicles.map((v) => ({ ...v, eligibility: (0, vehicle_status_1.vehicleEligibility)(v) }));
    }
    async submit(actorId, vehicleId) {
        const access = await this.managementScope(actorId, vehicleId);
        return this.prisma.$transaction(async (tx) => {
            const vehicle = await tx.vehicle.findFirst({
                where: access,
                include: { media: true },
            });
            if (!vehicle)
                throw new common_1.NotFoundException('Your vehicle was not found');
            if (!['DRAFT', 'REJECTED'].includes(vehicle.approvalStatus))
                throw new common_1.BadRequestException(`A ${vehicle.approvalStatus.replace('_', ' ').toLowerCase()} listing cannot be submitted again`);
            if (!vehicle.registrationNumber ||
                !validation_1.PHOTO_KINDS.every((kind) => vehicle.media.some((m) => m.kind === kind)))
                throw new common_1.BadRequestException('Add the registration number and all eight photo angles before submitting');
            const changed = await tx.vehicle.updateMany({
                where: { id: vehicleId, approvalStatus: vehicle.approvalStatus },
                data: {
                    approvalStatus: 'PENDING_APPROVAL',
                    rejectedReason: null,
                    status: (0, vehicle_status_1.legacyVehicleStatus)('PENDING_APPROVAL', vehicle.availability, vehicle.availabilityReason),
                },
            });
            if (changed.count !== 1)
                throw new common_1.ConflictException('Vehicle changed. Refresh and retry.');
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
    async setAvailability(actorId, vehicleId, body) {
        const availability = (0, validation_1.choice)(body.availability, 'Availability', vehicle_status_1.AVAILABILITY_STATES);
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
                throw new common_1.NotFoundException('Your vehicle was not found');
            const vehicle = await tx.vehicle.findUniqueOrThrow({
                where: { id: vehicleId },
                include: { documents: true },
            });
            const asAdmin = actor?.role === 'ADMIN' && vehicle.hostId !== actorId;
            const restricted = (0, vehicle_status_1.isAdministrativeRestriction)(vehicle.availabilityReason);
            const reason = availability === 'ACTIVE'
                ? null
                : asAdmin
                    ? (0, validation_1.choice)(body.reason ?? 'ADMIN_SUSPENDED', 'Reason', [
                        'ADMIN_SUSPENDED',
                        'MAINTENANCE',
                    ])
                    : 'OWNER_PAUSED';
            if (!asAdmin &&
                availability === 'INACTIVE' &&
                vehicle.availability === 'INACTIVE' &&
                restricted)
                return { ...vehicle, flaggedBookings: 0 };
            if (!asAdmin && availability === 'ACTIVE' && restricted)
                throw new common_1.ForbiddenException({
                    message: 'Only a Safar administrator can lift this restriction.',
                    reasons: ['RESTRICTED_' + vehicle.availabilityReason],
                });
            if (vehicle.availability === availability &&
                vehicle.availabilityReason === reason)
                return { ...vehicle, flaggedBookings: 0 };
            if (availability === 'ACTIVE') {
                const { bookable, reasons } = (0, vehicle_status_1.vehicleEligibility)({
                    ...vehicle,
                    availability: 'ACTIVE',
                });
                if (!bookable)
                    throw new common_1.BadRequestException({
                        message: 'This car cannot accept bookings until it is approved and its RC, Insurance and PUC are valid.',
                        reasons,
                    });
            }
            await tx.vehicle.update({
                where: { id: vehicleId },
                data: {
                    availability,
                    availabilityReason: reason,
                    status: (0, vehicle_status_1.legacyVehicleStatus)(vehicle.approvalStatus, availability, reason),
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
            const flaggedBookings = availability === 'INACTIVE'
                ? await (0, vehicle_status_1.flagUpcomingBookings)(tx, vehicleId, 'VEHICLE_INACTIVE', actorId)
                : 0;
            return {
                ...(await tx.vehicle.findUniqueOrThrow({ where: { id: vehicleId } })),
                flaggedBookings,
            };
        });
    }
    async create(hostId, data) {
        const user = await this.prisma.user.findUnique({ where: { id: hostId } });
        if (!user || !validation_1.FLEET_ROLES.includes(user.role))
            throw new common_1.ForbiddenException('Register a host or dealer account to list a car');
        const details = await this.listingDetails(data);
        const ids = data.mediaIds;
        if (!Array.isArray(ids) || ids.length !== validation_1.PHOTO_KINDS.length || new Set(ids).size !== ids.length || ids.some(v => typeof v !== 'string'))
            throw new common_1.BadRequestException('Upload all eight required photo views');
        return this.prisma.$transaction(async (tx) => {
            const photos = await tx.media.findMany({ where: { id: { in: ids }, ownerId: hostId, vehicleId: null } });
            if (!validation_1.PHOTO_KINDS.every(kind => photos.some(p => p.kind === kind)))
                throw new common_1.BadRequestException('Missing required photo views or invalid photo ownership');
            if (new Set(photos.map(photo => photo.sha256)).size !== validation_1.PHOTO_KINDS.length)
                throw new common_1.BadRequestException('Use a different photo for each vehicle angle. RC documents belong in the document upload section.');
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
            if (linked.count !== validation_1.PHOTO_KINDS.length)
                throw new common_1.BadRequestException('Photos already used');
            return vehicle;
        });
    }
    async createByAdmin(adminId, data, externalImageUrl) {
        const details = await this.listingDetails(data);
        const ids = data.mediaIds === undefined ? [] : data.mediaIds;
        if (!Array.isArray(ids) || ids.length > validation_1.PHOTO_KINDS.length || new Set(ids).size !== ids.length || ids.some(v => typeof v !== 'string'))
            throw new common_1.BadRequestException('Photos must be a list of up to eight uploaded photo ids');
        return this.prisma.$transaction(async (tx) => {
            const photos = await this.validPhotos(tx, adminId, ids, []);
            const approvalStatus = photos.length === validation_1.PHOTO_KINDS.length ? 'PENDING_APPROVAL' : 'DRAFT';
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
                if (linked.count !== photos.length)
                    throw new common_1.BadRequestException('Photos already used');
            }
            const images = JSON.stringify([...this.orderedPhotoUrls(photos), ...(externalImageUrl ? [externalImageUrl] : [])]);
            const created = await tx.vehicle.update({ where: { id: vehicle.id }, data: { images } });
            await tx.auditLog.create({ data: { actorId: adminId, action: 'VEHICLE_CREATED_BY_ADMIN', targetId: vehicle.id, detail: JSON.stringify({ make: details.make, model: details.model, registrationNumber: details.registrationNumber, pricePerDay: details.pricePerDay, photoKinds: photos.map(p => p.kind), status: 'PENDING_APPROVAL', approvalStatus }) } });
            return created;
        });
    }
    async addPhotos(actorId, vehicleId, data) {
        const ids = data.mediaIds;
        if (!Array.isArray(ids) || !ids.length || ids.length > validation_1.PHOTO_KINDS.length || new Set(ids).size !== ids.length || ids.some(v => typeof v !== 'string'))
            throw new common_1.BadRequestException('Choose one or more uploaded photos');
        const access = await this.managementScope(actorId, vehicleId);
        return this.prisma.$transaction(async (tx) => {
            const locked = await tx.vehicle.updateMany({ where: access, data: { updatedAt: new Date() } });
            if (!locked.count)
                throw new common_1.NotFoundException('Your vehicle was not found');
            const vehicle = await tx.vehicle.findUniqueOrThrow({ where: { id: vehicleId }, include: { media: true } });
            if (!['DRAFT', 'PENDING_APPROVAL', 'REJECTED'].includes(vehicle.approvalStatus))
                throw new common_1.BadRequestException('Photos can only be added while the listing is awaiting approval');
            const existing = vehicle.media.filter(m => validation_1.PHOTO_KINDS.includes(m.kind));
            const photos = await this.validPhotos(tx, actorId, ids, existing);
            const linked = await tx.media.updateMany({ where: { id: { in: ids }, ownerId: actorId, vehicleId: null }, data: { vehicleId } });
            if (linked.count !== photos.length)
                throw new common_1.BadRequestException('Photos already used');
            const external = JSON.parse(vehicle.images || '[]').filter((url) => typeof url === 'string' && url.startsWith('https://'));
            const updated = await tx.vehicle.update({ where: { id: vehicleId }, data: { images: JSON.stringify([...this.orderedPhotoUrls([...existing, ...photos]), ...external]) }, include: { media: { select: { id: true, kind: true } } } });
            await tx.auditLog.create({ data: { actorId, action: 'VEHICLE_PHOTOS_ADDED', targetId: vehicleId, detail: JSON.stringify({ kinds: photos.map(p => p.kind) }) } });
            if (vehicle.approvalStatus === 'DRAFT' &&
                vehicle.registrationNumber &&
                updated.media.filter((m) => validation_1.PHOTO_KINDS.includes(m.kind)).length === validation_1.PHOTO_KINDS.length) {
                await tx.vehicle.update({
                    where: { id: vehicleId },
                    data: {
                        approvalStatus: 'PENDING_APPROVAL',
                        status: (0, vehicle_status_1.legacyVehicleStatus)('PENDING_APPROVAL', vehicle.availability, vehicle.availabilityReason),
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
    async validPhotos(tx, ownerId, ids, existing) {
        if (!ids.length)
            return [];
        const photos = await tx.media.findMany({ where: { id: { in: ids }, ownerId, vehicleId: null } });
        if (photos.length !== ids.length || photos.some((p) => !validation_1.PHOTO_KINDS.includes(p.kind)))
            throw new common_1.BadRequestException('Use your own unlinked vehicle photos (front, rear, sides, interior, boot, bonnet, odometer)');
        const kinds = [...existing.map(m => m.kind), ...photos.map((p) => p.kind)];
        if (new Set(kinds).size !== kinds.length)
            throw new common_1.BadRequestException('Each photo angle can only be added once');
        const hashes = [...existing.map(m => m.sha256), ...photos.map((p) => p.sha256)];
        if (new Set(hashes).size !== hashes.length)
            throw new common_1.BadRequestException('Use a different photo for each vehicle angle');
        return photos;
    }
    orderedPhotoUrls(photos) {
        return validation_1.PHOTO_KINDS.flatMap(kind => photos.filter(p => p.kind === kind).map(p => '/api/media/' + p.id));
    }
    async listingDetails(data) {
        const registrationNumber = (0, validation_1.text)(data.registrationNumber, 'Registration number', 16).replace(/\s/g, '').toUpperCase();
        if (!/^[A-Z0-9-]{6,16}$/.test(registrationNumber))
            throw new common_1.BadRequestException('Invalid registration number');
        if (await this.prisma.vehicle.findUnique({ where: { registrationNumber } }))
            throw new common_1.ConflictException('This registration number is already listed. Open My Fleet or contact an administrator.');
        const pricePerDay = (0, validation_1.number)(data.pricePerDay, 'Daily rate', 1, 1000000);
        if (Math.round(pricePerDay * 100) !== pricePerDay * 100)
            throw new common_1.BadRequestException('Use at most two decimal places');
        return {
            registrationNumber, make: (0, validation_1.text)(data.make, 'Make'), model: (0, validation_1.text)(data.model, 'Model'),
            year: (0, validation_1.number)(data.year, 'Year', 1990, new Date().getFullYear() + 1, true),
            category: (0, validation_1.choice)(data.category, 'Category', ['Hatchback', 'Sedan', 'Compact SUV', 'SUV', 'MUV', 'Luxury', 'EV']),
            transmission: (0, validation_1.choice)(data.transmission, 'Transmission', ['Manual', 'Automatic']),
            fuelType: (0, validation_1.choice)(data.fuelType, 'Fuel', ['Petrol', 'Diesel', 'Electric', 'CNG', 'Hybrid']),
            seats: (0, validation_1.number)(data.seats, 'Seats', 2, 12, true), pricePerDay,
            odometer: (0, validation_1.number)(data.odometer, 'Odometer', 0, 2000000, true),
            locationCity: (0, validation_1.text)(data.locationCity ?? data.city, 'City'),
        };
    }
};
exports.VehiclesService = VehiclesService;
exports.VehiclesService = VehiclesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], VehiclesService);
//# sourceMappingURL=vehicles.service.js.map