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
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const validation_1 = require("../common/validation");
let NotificationsService = class NotificationsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    list(userId) {
        return this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 });
    }
    async markRead(userId, id) {
        const result = await this.prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
        if (!result.count)
            throw new common_1.NotFoundException('Notification not found');
        return { id, readAt: new Date() };
    }
    async markAllRead(userId) {
        const result = await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
        return { updated: result.count };
    }
    async create(userId, data) {
        return this.prisma.notification.create({ data: {
                userId,
                type: (0, validation_1.text)(data.type, 'Notification type', 60),
                title: (0, validation_1.text)(data.title, 'Notification title', 160),
                message: (0, validation_1.text)(data.message, 'Notification message', 1000),
                bookingId: data.bookingId || null,
                metadata: data.metadata == null ? null : JSON.stringify(data.metadata),
            } });
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map