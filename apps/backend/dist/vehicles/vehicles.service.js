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
let VehiclesService = class VehiclesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    findAll(query) {
        const where = { status: 'ACTIVE' };
        if (query.startDate !== undefined || query.endDate !== undefined) {
            const { start, end } = (0, availability_1.rentalPeriod)(query.startDate, query.endDate);
            where.bookings = { none: (0, availability_1.overlappingReservations)(start, end) };
            where.availabilityBlocks = { none: { releasedAt: null, startDate: { lt: end }, endDate: { gt: start } } };
            where.AND = ['RC', 'INSURANCE', 'PUC'].map(kind => ({ documents: { some: { kind, status: 'APPROVED', validUntil: { gte: end } } } }));
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
        const vehicle = await this.prisma.vehicle.findFirst({ where: { id, status: 'ACTIVE' }, include: { media: { where: { kind: { in: [...validation_1.PHOTO_KINDS] } }, select: { id: true, kind: true } }, reviews: { include: { author: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' }, take: 20 } } });
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
        const documents = await this.prisma.document.findMany({ where: { vehicleId: id, status: 'APPROVED', validUntil: { gte: end } } });
        if (!['RC', 'INSURANCE', 'PUC'].every(kind => documents.some(d => d.kind === kind)))
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
    mine(hostId) { return this.prisma.vehicle.findMany({ where: { hostId }, include: { media: { select: { id: true, kind: true } }, documents: true }, orderBy: { createdAt: 'desc' } }); }
    async create(hostId, data) {
        const user = await this.prisma.user.findUnique({ where: { id: hostId } });
        if (!user || !validation_1.FLEET_ROLES.includes(user.role))
            throw new common_1.ForbiddenException('Register a host or dealer account to list a car');
        const registrationNumber = (0, validation_1.text)(data.registrationNumber, 'Registration number', 16).replace(/\s/g, '').toUpperCase();
        if (!/^[A-Z0-9-]{6,16}$/.test(registrationNumber))
            throw new common_1.BadRequestException('Invalid registration number');
        if (await this.prisma.vehicle.findUnique({ where: { registrationNumber } }))
            throw new common_1.ConflictException('This registration number is already listed. Open My Fleet or contact an administrator.');
        const ids = data.mediaIds;
        if (!Array.isArray(ids) || ids.length !== validation_1.PHOTO_KINDS.length || new Set(ids).size !== ids.length || ids.some(v => typeof v !== 'string'))
            throw new common_1.BadRequestException('Upload all eight required photo views');
        const price = (0, validation_1.number)(data.pricePerDay, 'Daily rate', 1, 1000000);
        if (Math.round(price * 100) !== price * 100)
            throw new common_1.BadRequestException('Use at most two decimal places');
        return this.prisma.$transaction(async (tx) => {
            const photos = await tx.media.findMany({ where: { id: { in: ids }, ownerId: hostId, vehicleId: null } });
            if (!validation_1.PHOTO_KINDS.every(kind => photos.some(p => p.kind === kind)))
                throw new common_1.BadRequestException('Missing required photo views or invalid photo ownership');
            if (new Set(photos.map(photo => photo.sha256)).size !== validation_1.PHOTO_KINDS.length)
                throw new common_1.BadRequestException('Use a different photo for each vehicle angle. RC documents belong in the document upload section.');
            const vehicle = await tx.vehicle.create({ data: {
                    hostId, registrationNumber, make: (0, validation_1.text)(data.make, 'Make'), model: (0, validation_1.text)(data.model, 'Model'),
                    year: (0, validation_1.number)(data.year, 'Year', 1990, new Date().getFullYear() + 1, true),
                    category: (0, validation_1.choice)(data.category, 'Category', ['Hatchback', 'Sedan', 'Compact SUV', 'SUV', 'MUV', 'Luxury', 'EV']),
                    transmission: (0, validation_1.choice)(data.transmission, 'Transmission', ['Manual', 'Automatic']),
                    fuelType: (0, validation_1.choice)(data.fuelType, 'Fuel', ['Petrol', 'Diesel', 'Electric', 'CNG', 'Hybrid']),
                    seats: (0, validation_1.number)(data.seats, 'Seats', 2, 12, true), pricePerDay: price,
                    odometer: (0, validation_1.number)(data.odometer, 'Odometer', 0, 2000000, true),
                    locationCity: (0, validation_1.text)(data.locationCity, 'City'), images: JSON.stringify(photos.map(p => '/api/media/' + p.id)),
                    status: 'PENDING_APPROVAL',
                } });
            const linked = await tx.media.updateMany({ where: { id: { in: ids }, ownerId: hostId, vehicleId: null }, data: { vehicleId: vehicle.id } });
            if (linked.count !== validation_1.PHOTO_KINDS.length)
                throw new common_1.BadRequestException('Photos already used');
            return vehicle;
        });
    }
};
exports.VehiclesService = VehiclesService;
exports.VehiclesService = VehiclesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], VehiclesService);
//# sourceMappingURL=vehicles.service.js.map