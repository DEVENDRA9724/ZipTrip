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
exports.ReviewsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const validation_1 = require("../common/validation");
let ReviewsService = class ReviewsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listForVehicle(vehicleId) {
        const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true } });
        if (!vehicle)
            throw new common_1.NotFoundException('Vehicle not found');
        const reviews = await this.prisma.review.findMany({
            where: { vehicleId },
            include: { author: { select: { firstName: true, lastName: true } } },
            orderBy: { createdAt: 'desc' }, take: 100,
        });
        const average = reviews.length ? reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length : null;
        return { reviews, count: reviews.length, average: average == null ? null : Math.round(average * 10) / 10 };
    }
    async create(authorId, body) {
        const bookingId = (0, validation_1.text)(body.bookingId, 'Booking', 80);
        const rating = (0, validation_1.number)(body.rating, 'Rating', 1, 5, true);
        const comment = body.comment == null || body.comment === '' ? null : (0, validation_1.text)(body.comment, 'Comment', 1000);
        const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, include: { vehicle: true } });
        if (!booking)
            throw new common_1.NotFoundException('Booking not found');
        if (booking.customerId !== authorId)
            throw new common_1.BadRequestException('Only the customer who completed the trip can review it');
        if (booking.status !== 'COMPLETED')
            throw new common_1.BadRequestException('Reviews are available after the trip is completed');
        const existing = await this.prisma.review.findFirst({ where: { authorId, vehicleId: booking.vehicleId } });
        if (existing)
            throw new common_1.ConflictException('You have already reviewed this vehicle');
        return this.prisma.review.create({ data: { authorId, vehicleId: booking.vehicleId, rating, comment } });
    }
    async listForUser(userId) {
        const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        const ratings = await this.prisma.partyRating.findMany({
            where: { targetId: userId },
            include: { author: { select: { firstName: true, lastName: true, role: true } } },
            orderBy: { createdAt: 'desc' }, take: 100,
        });
        const average = ratings.length ? ratings.reduce((sum, item) => sum + item.rating, 0) / ratings.length : null;
        return { ratings, count: ratings.length, average: average == null ? null : Math.round(average * 10) / 10 };
    }
    async listAuthored(userId) {
        const [vehicleReviews, partyRatings] = await Promise.all([
            this.prisma.review.findMany({
                where: { authorId: userId },
                include: { vehicle: { select: { id: true, make: true, model: true, year: true, registrationNumber: true } } },
                orderBy: { createdAt: 'desc' },
                take: 100,
            }),
            this.prisma.partyRating.findMany({
                where: { authorId: userId },
                include: { target: { select: { firstName: true, lastName: true, role: true } }, booking: { select: { bookingRef: true } } },
                orderBy: { createdAt: 'desc' },
                take: 100,
            }),
        ]);
        return { vehicleReviews, partyRatings };
    }
    async createParty(author, body) {
        const bookingId = (0, validation_1.text)(body.bookingId, 'Booking', 80);
        const targetRole = (0, validation_1.text)(body.targetRole, 'Rating target', 20).toUpperCase();
        if (!['HOST', 'CUSTOMER'].includes(targetRole))
            throw new common_1.BadRequestException('Rating target must be HOST or CUSTOMER');
        const rating = (0, validation_1.number)(body.rating, 'Rating', 1, 5, true);
        const comment = body.comment == null || body.comment === '' ? null : (0, validation_1.text)(body.comment, 'Comment', 1000);
        const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, include: { vehicle: true } });
        if (!booking)
            throw new common_1.NotFoundException('Booking not found');
        if (booking.status !== 'COMPLETED')
            throw new common_1.BadRequestException('Party ratings are available after the trip is completed');
        let targetId;
        if (targetRole === 'HOST') {
            if (author.role !== 'CUSTOMER' || booking.customerId !== author.id)
                throw new common_1.BadRequestException('Only the customer can rate the host');
            targetId = booking.vehicle.hostId;
        }
        else {
            if (!['HOST', 'DEALER'].includes(author.role) || booking.vehicle.hostId !== author.id)
                throw new common_1.BadRequestException('Only the vehicle host can rate the customer');
            targetId = booking.customerId;
        }
        const existing = await this.prisma.partyRating.findUnique({ where: { bookingId_authorId_targetId: { bookingId, authorId: author.id, targetId } } });
        if (existing)
            throw new common_1.ConflictException('You have already rated this party for the booking');
        return this.prisma.partyRating.create({
            data: { bookingId, authorId: author.id, targetId, targetRole, rating, comment },
            include: { target: { select: { firstName: true, lastName: true, role: true } } },
        });
    }
};
exports.ReviewsService = ReviewsService;
exports.ReviewsService = ReviewsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ReviewsService);
//# sourceMappingURL=reviews.service.js.map