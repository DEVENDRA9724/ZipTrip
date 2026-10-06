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
}
