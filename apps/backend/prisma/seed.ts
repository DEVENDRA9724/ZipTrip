import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import * as bcrypt from 'bcryptjs';

const adapter = new PrismaBetterSqlite3({ url: 'file:dev.db' });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Clear database
  await prisma.review.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.booking.deleteMany({});
  await prisma.wallet.deleteMany({});
  await prisma.vehicle.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('Cleared database.');

  // Create hashed password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('password123', salt);

  // Users
  const customer = await prisma.user.create({
    data: {
      email: 'customer@example.com',
      firstName: 'Deven',
      lastName: 'Sharma',
      phone: '+919876543210',
      passwordHash,
      role: 'CUSTOMER',
      isVerified: true,
      wallet: {
        create: {
          balance: 5000.0,
        },
      },
    },
  });

  const host = await prisma.user.create({
    data: {
      email: 'host@example.com',
      firstName: 'Rajesh',
      lastName: 'Kumar',
      phone: '+919999999999',
      passwordHash,
      role: 'HOST',
      isVerified: true,
      wallet: {
        create: {
          balance: 12000.0,
        },
      },
    },
  });

  const admin = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      firstName: 'Admin',
      lastName: 'ZipTrip',
      phone: '+918888888888',
      passwordHash,
      role: 'ADMIN',
      isVerified: true,
    },
  });

  console.log('Created Users and Wallets.');

  // Safar Self Drive & Gujarat Taxi Fleet
  const v1 = await prisma.vehicle.create({
    data: {
      hostId: host.id,
      make: 'Mahindra',
      model: 'Thar 4x4 (Self Drive - Private No.)',
      year: 2024,
      category: 'SUV',
      transmission: 'Automatic',
      fuelType: 'Diesel',
      seats: 4,
      pricePerDay: 3500.0,
      status: 'ACTIVE',
      locationCity: 'Ahmedabad',
      latitude: 23.0225,
      longitude: 72.5714,
      images: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=800,https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&q=80&w=800',
    },
  });

  const v2 = await prisma.vehicle.create({
    data: {
      hostId: host.id,
      make: 'Hyundai',
      model: 'Creta SX (Self Drive - Private No.)',
      year: 2023,
      category: 'SUV',
      transmission: 'Automatic',
      fuelType: 'Diesel',
      seats: 5,
      pricePerDay: 2400.0,
      status: 'ACTIVE',
      locationCity: 'Ahmedabad',
      latitude: 23.0338,
      longitude: 72.5463,
      images: 'https://images.unsplash.com/photo-1605558158359-18c1480b868e?auto=format&fit=crop&q=80&w=800,https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&q=80&w=800',
    },
  });

  const v3 = await prisma.vehicle.create({
    data: {
      hostId: host.id,
      make: 'Maruti Suzuki',
      model: 'Swift ZXi (Self Drive - Private No.)',
      year: 2023,
      category: 'Hatchback',
      transmission: 'Manual',
      fuelType: 'Petrol',
      seats: 5,
      pricePerDay: 1200.0,
      status: 'ACTIVE',
      locationCity: 'Surat',
      latitude: 21.1702,
      longitude: 72.8311,
      images: 'https://images.unsplash.com/photo-1619767886558-efdc259cde1a?auto=format&fit=crop&q=80&w=800',
    },
  });

  const v4 = await prisma.vehicle.create({
    data: {
      hostId: host.id,
      make: 'Toyota',
      model: 'Innova Crysta 2.4 ZX (Self Drive - Private No.)',
      year: 2023,
      category: 'SUV',
      transmission: 'Automatic',
      fuelType: 'Diesel',
      seats: 7,
      pricePerDay: 3200.0,
      status: 'ACTIVE',
      locationCity: 'Vadodara',
      latitude: 22.3072,
      longitude: 73.1812,
      images: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&q=80&w=800',
    },
  });

  const v5 = await prisma.vehicle.create({
    data: {
      hostId: host.id,
      make: 'Mercedes-Benz',
      model: 'E-Class (Taxi with Driver - Luxury)',
      year: 2023,
      category: 'Luxury',
      transmission: 'Automatic',
      fuelType: 'Petrol',
      seats: 4,
      pricePerDay: 8500.0,
      status: 'ACTIVE',
      locationCity: 'Ahmedabad',
      latitude: 23.0664,
      longitude: 72.5312,
      images: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&q=80&w=800,https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&q=80&w=800',
    },
  });

  const v6 = await prisma.vehicle.create({
    data: {
      hostId: host.id,
      make: 'BMW',
      model: '5 Series 530d (Taxi with Driver - Luxury)',
      year: 2023,
      category: 'Luxury',
      transmission: 'Automatic',
      fuelType: 'Diesel',
      seats: 4,
      pricePerDay: 8000.0,
      status: 'ACTIVE',
      locationCity: 'Surat',
      latitude: 21.2012,
      longitude: 72.8456,
      images: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&q=80&w=800',
    },
  });

  const v7 = await prisma.vehicle.create({
    data: {
      hostId: host.id,
      make: 'Audi',
      model: 'A6 Matrix (Taxi with Driver - Luxury)',
      year: 2022,
      category: 'Luxury',
      transmission: 'Automatic',
      fuelType: 'Petrol',
      seats: 4,
      pricePerDay: 7500.0,
      status: 'ACTIVE',
      locationCity: 'Vadodara',
      latitude: 22.3101,
      longitude: 73.1901,
      images: 'https://images.unsplash.com/photo-1603584173870-7f23fdae1b7a?auto=format&fit=crop&q=80&w=800',
    },
  });

  const v8 = await prisma.vehicle.create({
    data: {
      hostId: host.id,
      make: 'Honda',
      model: 'City ZX (Taxi with Driver - ₹12/km)',
      year: 2023,
      category: 'Sedan',
      transmission: 'Manual',
      fuelType: 'Petrol',
      seats: 4,
      pricePerDay: 2000.0,
      status: 'ACTIVE',
      locationCity: 'Rajkot',
      latitude: 22.3039,
      longitude: 70.8022,
      images: 'https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&q=80&w=800',
    },
  });

  const v9 = await prisma.vehicle.create({
    data: {
      hostId: host.id,
      make: 'Toyota',
      model: 'Fortuner Legender 4x4 (Taxi with Driver - Premium)',
      year: 2023,
      category: 'SUV',
      transmission: 'Automatic',
      fuelType: 'Diesel',
      seats: 7,
      pricePerDay: 5500.0,
      status: 'ACTIVE',
      locationCity: 'Gandhinagar',
      latitude: 23.2156,
      longitude: 72.6369,
      images: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&q=80&w=800',
    },
  });

  const v10 = await prisma.vehicle.create({
    data: {
      hostId: host.id,
      make: 'Force',
      model: 'Tempo Traveller Luxury 17-Seater (Tour Taxi - ₹22/km)',
      year: 2023,
      category: 'SUV',
      transmission: 'Manual',
      fuelType: 'Diesel',
      seats: 17,
      pricePerDay: 6000.0,
      status: 'ACTIVE',
      locationCity: 'Ahmedabad',
      latitude: 23.0125,
      longitude: 72.5814,
      images: 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&q=80&w=800',
    },
  });

  console.log('Created Vehicles for Safar Self Drive & Gujarat Taxi.');

  // Reviews
  await prisma.review.create({
    data: {
      authorId: customer.id,
      vehicleId: v1.id,
      rating: 5,
      comment: 'Thar 4x4 in private number plate was in mint condition! Took it from Ahmedabad to Gir and Somnath. Best self-drive service in Gujarat.',
    },
  });

  await prisma.review.create({
    data: {
      authorId: customer.id,
      vehicleId: v5.id,
      rating: 5,
      comment: 'Booked the Mercedes E-Class taxi with driver for business client pickup at Ahmedabad Airport. Impeccable chauffeur service and crystal clear kilometer billing.',
    },
  });

  console.log('Created Reviews.');
  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
