import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { number, text } from '../common/validation';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForVehicle(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    const reviews = await this.prisma.review.findMany({
      where: { vehicleId },
      include: { author: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' }, take: 100,
    });
    const average = reviews.length ? reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length : null;
    return { reviews, count: reviews.length, average: average == null ? null : Math.round(average * 10) / 10 };
  }

  async create(authorId: string, body: any) {
    const bookingId = text(body.bookingId, 'Booking', 80);
    const rating = number(body.rating, 'Rating', 1, 5, true);
    const comment = body.comment == null || body.comment === '' ? null : text(body.comment, 'Comment', 1000);
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, include: { vehicle: true } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.customerId !== authorId) throw new BadRequestException('Only the customer who completed the trip can review it');
    if (booking.status !== 'COMPLETED') throw new BadRequestException('Reviews are available after the trip is completed');
    const existing = await this.prisma.review.findFirst({ where: { authorId, vehicleId: booking.vehicleId } });
    if (existing) throw new ConflictException('You have already reviewed this vehicle');
    return this.prisma.review.create({ data: { authorId, vehicleId: booking.vehicleId, rating, comment } });
  }

  async listForUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');
    const ratings = await this.prisma.partyRating.findMany({
      where: { targetId: userId },
      include: { author: { select: { firstName: true, lastName: true, role: true } } },
      orderBy: { createdAt: 'desc' }, take: 100,
    });
    const average = ratings.length ? ratings.reduce((sum, item) => sum + item.rating, 0) / ratings.length : null;
    return { ratings, count: ratings.length, average: average == null ? null : Math.round(average * 10) / 10 };
  }

  async createParty(author: { id: string; role: string }, body: any) {
    const bookingId = text(body.bookingId, 'Booking', 80);
    const targetRole = text(body.targetRole, 'Rating target', 20).toUpperCase();
    if (!['HOST', 'CUSTOMER'].includes(targetRole)) throw new BadRequestException('Rating target must be HOST or CUSTOMER');
    const rating = number(body.rating, 'Rating', 1, 5, true);
    const comment = body.comment == null || body.comment === '' ? null : text(body.comment, 'Comment', 1000);
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, include: { vehicle: true } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'COMPLETED') throw new BadRequestException('Party ratings are available after the trip is completed');

    let targetId: string;
    if (targetRole === 'HOST') {
      if (author.role !== 'CUSTOMER' || booking.customerId !== author.id) throw new BadRequestException('Only the customer can rate the host');
      targetId = booking.vehicle.hostId;
    } else {
      if (!['HOST', 'DEALER'].includes(author.role) || booking.vehicle.hostId !== author.id) throw new BadRequestException('Only the vehicle host can rate the customer');
      targetId = booking.customerId;
    }

    const existing = await this.prisma.partyRating.findUnique({ where: { bookingId_authorId_targetId: { bookingId, authorId: author.id, targetId } } });
    if (existing) throw new ConflictException('You have already rated this party for the booking');
    return this.prisma.partyRating.create({
      data: { bookingId, authorId: author.id, targetId, targetRole, rating, comment },
      include: { target: { select: { firstName: true, lastName: true, role: true } } },
    });
  }
}
