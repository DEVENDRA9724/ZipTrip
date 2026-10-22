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
var HoldExpiryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HoldExpiryService = exports.HOLD_EXPIRED = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
exports.HOLD_EXPIRED = 'HOLD_EXPIRED';
const BATCH_SIZE = 100;
let HoldExpiryService = HoldExpiryService_1 = class HoldExpiryService {
    prisma;
    logger = new common_1.Logger(HoldExpiryService_1.name);
    timer;
    running = false;
    constructor(prisma) {
        this.prisma = prisma;
    }
    onApplicationBootstrap() {
        const configured = process.env.HOLD_EXPIRY_INTERVAL_MS;
        const interval = configured === undefined
            ? process.env.NODE_ENV === 'test'
                ? 0
                : 60000
            : Number(configured);
        if (!Number.isFinite(interval) || interval <= 0)
            return;
        const tick = () => void this.expireHolds().catch((error) => this.logger.error(`Hold expiry sweep failed: ${error?.message}`));
        this.timer = setInterval(tick, Math.max(interval, 5000));
        this.timer.unref();
        tick();
    }
    onModuleDestroy() {
        if (this.timer)
            clearInterval(this.timer);
    }
    async expireHolds(now = new Date()) {
        if (this.running)
            return { expired: 0 };
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
                    const changed = await tx.booking.updateMany({
                        where: {
                            id,
                            status: 'PENDING',
                            expiresAt: { lte: now },
                            payment: { is: null },
                        },
                        data: { status: 'CANCELLED' },
                    });
                    if (changed.count !== 1)
                        return false;
                    const booking = await tx.booking.findUnique({
                        where: { id },
                        select: { expiresAt: true, vehicleId: true, customerId: true },
                    });
                    await tx.auditLog.create({
                        data: {
                            actorId: 'SYSTEM',
                            action: exports.HOLD_EXPIRED,
                            targetId: id,
                            detail: JSON.stringify({
                                reason: exports.HOLD_EXPIRED,
                                expiresAt: booking?.expiresAt,
                                vehicleId: booking?.vehicleId,
                                customerId: booking?.customerId,
                            }),
                        },
                    });
                    return true;
                });
                if (cancelled)
                    expired++;
            }
            if (expired)
                this.logger.log(`Released ${expired} expired checkout hold(s)`);
            return { expired };
        }
        finally {
            this.running = false;
        }
    }
};
exports.HoldExpiryService = HoldExpiryService;
exports.HoldExpiryService = HoldExpiryService = HoldExpiryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], HoldExpiryService);
//# sourceMappingURL=hold-expiry.service.js.map