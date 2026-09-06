import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: any) {
    const { city, category, transmission, seats, maxPrice, search } = query;

    const where: any = {
      status: 'ACTIVE',
    };

    if (city && city !== 'All') {
      where.locationCity = city;
    }

    if (category) {
      where.category = category;
    }

    if (transmission) {
      where.transmission = transmission;
    }

    if (seats) {
      where.seats = parseInt(seats, 10);
    }

    if (maxPrice) {
      where.pricePerDay = {
        lte: parseFloat(maxPrice),
      };
    }

    if (search) {
      where.OR = [
        { make: { contains: search } },
        { model: { contains: search } },
      ];
    }

    return this.prisma.vehicle.findMany({
      where,
      include: {
        reviews: {
          select: {
            rating: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
      include: {
        host: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profileImage: true,
          },
        },
        reviews: {
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profileImage: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    return vehicle;
  }

  async create(hostId: string, data: any) {
    return this.prisma.vehicle.create({
      data: {
        hostId,
        make: data.make,
        model: data.model,
        year: parseInt(data.year, 10),
        category: data.category,
        transmission: data.transmission,
        fuelType: data.fuelType,
        seats: parseInt(data.seats, 10),
        pricePerDay: parseFloat(data.pricePerDay),
        locationCity: data.locationCity,
        latitude: data.latitude ? parseFloat(data.latitude) : null,
        longitude: data.longitude ? parseFloat(data.longitude) : null,
        images: data.images || '',
        status: 'ACTIVE', // Automatically make active for local development
      },
    });
  }
}
