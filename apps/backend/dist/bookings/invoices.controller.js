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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoicesController = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
let InvoicesController = class InvoicesController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async get(req, id) {
        const invoice = await this.prisma.invoice.findUnique({ where: { id }, include: { booking: { include: { vehicle: true } } } });
        if (!invoice)
            throw new common_1.NotFoundException('Invoice not found');
        if (invoice.booking.customerId !== req.user.id && invoice.booking.vehicle.hostId !== req.user.id && req.user.role !== 'ADMIN')
            throw new common_1.ForbiddenException('Invoice access denied');
        const { booking, snapshot, ...result } = invoice;
        return { ...result, bookingRef: booking.bookingRef, details: JSON.parse(snapshot) };
    }
};
exports.InvoicesController = InvoicesController;
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], InvoicesController.prototype, "get", null);
exports.InvoicesController = InvoicesController = __decorate([
    (0, common_1.Controller)('invoices'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], InvoicesController);
//# sourceMappingURL=invoices.controller.js.map