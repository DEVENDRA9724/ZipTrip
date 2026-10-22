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
var OperationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperationsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const notifications_service_1 = require("../notifications/notifications.service");
let OperationsService = OperationsService_1 = class OperationsService {
    prisma;
    notifications;
    logger = new common_1.Logger(OperationsService_1.name);
    timer;
    constructor(prisma, notifications) {
        this.prisma = prisma;
        this.notifications = notifications;
    }
    onModuleInit() {
        if (process.env.ENABLE_OPERATIONS_JOBS === 'false')
            return;
        const intervalMs = Math.max(30_000, Number(process.env.OPERATIONS_JOB_INTERVAL_MS || 300_000));
        this.timer = setInterval(() => void this.reconcile().catch(error => this.logger.error(error)), intervalMs);
        this.timer.unref();
        void this.reconcile().catch(error => this.logger.error(error));
    }
    onModuleDestroy() {
        if (this.timer)
            clearInterval(this.timer);
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
            if (!changed.count)
                continue;
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
            if (!changed.count)
                continue;
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
};
exports.OperationsService = OperationsService;
exports.OperationsService = OperationsService = OperationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, notifications_service_1.NotificationsService])
], OperationsService);
//# sourceMappingURL=operations.service.js.map