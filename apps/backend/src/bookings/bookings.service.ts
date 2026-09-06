import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  async create(customerId: string, data: any) {
    const { vehicleId, startDate, endDate } = data;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid start or end date');
    }

    if (start >= end) {
      throw new BadRequestException('End date must be after start date');
    }

    // Get vehicle
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: { host: { include: { wallet: true } } },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    if (vehicle.status !== 'ACTIVE') {
      throw new BadRequestException('Vehicle is currently not active for rent');
    }

    if (vehicle.hostId === customerId) {
      throw new BadRequestException('You cannot rent your own vehicle');
    }

    // Check date overlaps
    const conflict = await this.prisma.booking.findFirst({
      where: {
        vehicleId,
        status: { in: ['CONFIRMED', 'ACTIVE'] },
        OR: [
          {
            startDate: { lte: end },
            endDate: { gte: start },
          },
        ],
      },
    });

    if (conflict) {
      throw new BadRequestException('This vehicle is already booked for the selected dates');
    }

    // Get customer wallet
    const customerWallet = await this.prisma.wallet.findUnique({
      where: { userId: customerId },
    });

    if (!customerWallet) {
      throw new BadRequestException('Customer wallet not found');
    }

    // Calculate duration & price
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const totalDays = Math.max(1, diffDays);

    const pricePerDay = Number(vehicle.pricePerDay);
    const totalAmount = pricePerDay * totalDays;

    const customerBalance = Number(customerWallet.balance);
    if (customerBalance < totalAmount) {
      throw new BadRequestException(`Insufficient wallet balance. Required: INR ${totalAmount}, Available: INR ${customerBalance}`);
    }

    // Generate unique bookingRef
    const bookingRef = 'ZT-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    // Perform database updates
    // Using a manual promise sequence to prevent SQLite lockups
    const updatedCustomerWallet = await this.prisma.wallet.update({
      where: { id: customerWallet.id },
      data: {
        balance: {
          decrement: totalAmount,
        },
      },
    });

    // Credit host wallet
    if (vehicle.host.wallet) {
      await this.prisma.wallet.update({
        where: { id: vehicle.host.wallet.id },
        data: {
          balance: {
            increment: totalAmount,
          },
        },
      });
    }

    const booking = await this.prisma.booking.create({
      data: {
        bookingRef,
        customerId,
        vehicleId,
        startDate: start,
        endDate: end,
        totalAmount,
        status: 'CONFIRMED',
        payment: {
          create: {
            transactionId: 'TXN-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
            amount: totalAmount,
            status: 'SUCCESS',
            currency: 'INR',
          },
        },
      },
      include: {
        vehicle: true,
        payment: true,
      },
    });

    return booking;
  }

  async getMyTrips(customerId: string) {
    return this.prisma.booking.findMany({
      where: { customerId },
      include: {
        vehicle: true,
        payment: true,
      },
      orderBy: {
        startDate: 'desc',
      },
    });
  }

  async getHostBookings(hostId: string) {
    return this.prisma.booking.findMany({
      where: {
        vehicle: {
          hostId,
        },
      },
      include: {
        vehicle: true,
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        payment: true,
      },
      orderBy: {
        startDate: 'desc',
      },
    });
  }

  async cancel(userId: string, id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        vehicle: { include: { host: { include: { wallet: true } } } },
        customer: { include: { wallet: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.customerId !== userId && booking.vehicle.hostId !== userId) {
      throw new BadRequestException('You do not have permission to cancel this booking');
    }

    if (booking.status !== 'CONFIRMED') {
      throw new BadRequestException(`Cannot cancel a booking in ${booking.status} status`);
    }

    const amount = Number(booking.totalAmount);

    // Refund customer
    if (booking.customer.wallet) {
      await this.prisma.wallet.update({
        where: { id: booking.customer.wallet.id },
        data: {
          balance: {
            increment: amount,
          },
        },
      });
    }

    // Debit host
    if (booking.vehicle.host.wallet) {
      await this.prisma.wallet.update({
        where: { id: booking.vehicle.host.wallet.id },
        data: {
          balance: {
            decrement: amount,
          },
        },
      });
    }

    // Update booking status
    return this.prisma.booking.update({
      where: { id },
      data: {
        status: 'CANCELLED',
      },
      include: {
        vehicle: true,
      },
    });
  }
}
