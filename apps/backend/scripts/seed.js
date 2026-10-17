const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const dbUrl = process.env.DATABASE_URL || 'file:./portal.db';
const adapter = /^postgres(ql)?:\/\//.test(dbUrl)
  ? new PrismaPg({ connectionString: dbUrl })
  : new PrismaBetterSqlite3({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

const PHOTO_KINDS = ['FRONT', 'REAR', 'LEFT', 'RIGHT', 'INTERIOR', 'BOOT', 'BONNET', 'ODOMETER'];

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const s3Bucket = (process.env.S3_BUCKET || '').trim();
const s3Region = (process.env.AWS_REGION || '').trim();
const s3Prefix = (process.env.S3_PREFIX || 'safar-media').replace(/^\/+|\/+$/g, '');
const s3Client = (s3Bucket && s3Region)
  ? new S3Client({
      region: s3Region,
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    })
  : null;

async function createMediaFromImage(ownerId, filePath, kind) {
  const uploadDir = path.resolve(__dirname, '../uploads');
  fs.mkdirSync(uploadDir, { recursive: true });

  const rawBuffer = fs.readFileSync(filePath);
  const buffer = await sharp(rawBuffer)
    .resize({ width: 1200, height: 800, fit: 'cover' })
    .jpeg({ quality: 85 })
    .toBuffer();

  const fileName = crypto.randomUUID() + '.jpg';
  let storageKey = fileName;

  if (s3Client) {
    try {
      const s3Key = `${s3Prefix}/${fileName}`;
      await s3Client.send(new PutObjectCommand({
        Bucket: s3Bucket,
        Key: s3Key,
        Body: buffer,
        ContentType: 'image/jpeg',
        ServerSideEncryption: 'AES256',
      }));
      storageKey = s3Key;
    } catch (err) {
      // Fallback to local ./uploads if IAM Role / S3 credentials are not attached yet
      const targetPath = path.join(uploadDir, fileName);
      fs.writeFileSync(targetPath, buffer);
    }
  } else {
    const targetPath = path.join(uploadDir, fileName);
    fs.writeFileSync(targetPath, buffer);
  }

  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  return prisma.media.create({
    data: {
      ownerId,
      kind,
      storageKey,
      mimeType: 'image/jpeg',
      size: buffer.length,
      sha256,
    },
  });
}

async function seed() {
  console.log('Seeding Safar database...');

  // 1. Admin
  const adminPasswordHash = await bcrypt.hash('Admin@12345678', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@safar.com' },
    update: { isVerified: true, role: 'ADMIN' },
    create: {
      email: 'admin@safar.com',
      firstName: 'Operations',
      lastName: 'Admin',
      role: 'ADMIN',
      isVerified: true,
      passwordHash: adminPasswordHash,
      wallet: { create: { balance: 0.0 } },
    },
  });
  console.log('Admin ready: admin@safar.com');

  // 2. Host
  const hostPasswordHash = await bcrypt.hash('Host@12345678', 12);
  const host = await prisma.user.upsert({
    where: { email: 'host@safar.com' },
    update: { isVerified: true, role: 'HOST' },
    create: {
      email: 'host@safar.com',
      firstName: 'Rajesh',
      lastName: 'Patel',
      phone: '+919876543210',
      role: 'HOST',
      isVerified: true,
      passwordHash: hostPasswordHash,
      wallet: { create: { balance: 0.0 } },
    },
  });
  console.log('Host ready: host@safar.com');

  // 3. Customer (Verified for booking)
  const custPasswordHash = await bcrypt.hash('Customer@12345678', 12);
  const customer = await prisma.user.upsert({
    where: { email: 'customer@safar.com' },
    update: {
      isVerified: true,
      dlValidUntil: new Date('2029-12-31T23:59:59Z'),
      role: 'CUSTOMER',
    },
    create: {
      email: 'customer@safar.com',
      firstName: 'Aarav',
      lastName: 'Shah',
      phone: '+919812345678',
      role: 'CUSTOMER',
      isVerified: true,
      dlValidUntil: new Date('2029-12-31T23:59:59Z'),
      passwordHash: custPasswordHash,
      wallet: { create: { balance: 5000.0 } },
    },
  });

  // Seed Aadhaar and DL documents for customer so verification checks succeed
  const existingCustDocs = await prisma.document.findMany({ where: { userId: customer.id } });
  if (!existingCustDocs.some(d => d.kind === 'AADHAAR')) {
    await prisma.document.create({
      data: {
        userId: customer.id,
        kind: 'AADHAAR',
        source: 'DIGILOCKER_LIVE',
        status: 'APPROVED',
        reviewNote: 'Aadhaar eKYC verified via Sandbox DigiLocker',
      },
    });
  }
  if (!existingCustDocs.some(d => d.kind === 'DL')) {
    await prisma.document.create({
      data: {
        userId: customer.id,
        kind: 'DL',
        source: 'DIGILOCKER_LIVE',
        status: 'APPROVED',
        validUntil: new Date('2029-12-31T23:59:59Z'),
        reviewNote: 'Driving Licence approved for LMV-NT / Transport class',
      },
    });
  }
  console.log('Customer ready: customer@safar.com (KYC & DL verified)');

  // 4. Sample Fleet
  const carsDir = path.resolve(__dirname, '../../web/cars');
  const sampleCars = [
    {
      make: 'Mahindra',
      model: 'Thar 4x4',
      year: 2024,
      category: 'SUV',
      transmission: 'Automatic',
      fuelType: 'Diesel',
      seats: 4,
      pricePerDay: 4500,
      odometer: 14200,
      locationCity: 'Ahmedabad',
      registrationNumber: 'GJ01TH4444',
      imageFile: 'thar.jpg',
    },
    {
      make: 'Hyundai',
      model: 'Creta SX(O)',
      year: 2023,
      category: 'SUV',
      transmission: 'Automatic',
      fuelType: 'Petrol',
      seats: 5,
      pricePerDay: 3200,
      odometer: 28500,
      locationCity: 'Ahmedabad',
      registrationNumber: 'GJ01CR7890',
      imageFile: 'creta.jpg',
    },
    {
      make: 'Toyota',
      model: 'Fortuner Legender',
      year: 2024,
      category: 'Luxury',
      transmission: 'Automatic',
      fuelType: 'Diesel',
      seats: 7,
      pricePerDay: 7500,
      odometer: 18900,
      locationCity: 'Gandhinagar',
      registrationNumber: 'GJ18FL1111',
      imageFile: 'fortuner.jpg',
    },
    {
      make: 'Toyota',
      model: 'Innova Crysta',
      year: 2023,
      category: 'MUV',
      transmission: 'Manual',
      fuelType: 'Diesel',
      seats: 7,
      pricePerDay: 3800,
      odometer: 42000,
      locationCity: 'Surat',
      registrationNumber: 'GJ05IN9999',
      imageFile: 'innova.jpg',
    },
    {
      make: 'Maruti Suzuki',
      model: 'Swift ZXi+',
      year: 2023,
      category: 'Hatchback',
      transmission: 'Manual',
      fuelType: 'Petrol',
      seats: 5,
      pricePerDay: 1800,
      odometer: 31000,
      locationCity: 'Vadodara',
      registrationNumber: 'GJ06SW5555',
      imageFile: 'swift.jpg',
    },
    {
      make: 'BMW',
      model: '3 Series Gran Limousine',
      year: 2024,
      category: 'Luxury',
      transmission: 'Automatic',
      fuelType: 'Petrol',
      seats: 5,
      pricePerDay: 9500,
      odometer: 9800,
      locationCity: 'Ahmedabad',
      registrationNumber: 'GJ01BM3333',
      imageFile: 'bmw.jpg',
    },
  ];

  for (const carData of sampleCars) {
    const existing = await prisma.vehicle.findUnique({
      where: { registrationNumber: carData.registrationNumber },
    });
    if (existing) {
      console.log(`Car already exists: ${carData.make} ${carData.model}`);
      continue;
    }

    const imgPath = path.join(carsDir, carData.imageFile);
    if (!fs.existsSync(imgPath)) {
      console.warn(`Image file not found: ${imgPath}`);
      continue;
    }

    // Create 8 photo views for each required angle
    const mediaList = [];
    for (const kind of PHOTO_KINDS) {
      const media = await createMediaFromImage(host.id, imgPath, kind);
      mediaList.push(media);
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        hostId: host.id,
        make: carData.make,
        model: carData.model,
        year: carData.year,
        category: carData.category,
        transmission: carData.transmission,
        fuelType: carData.fuelType,
        seats: carData.seats,
        pricePerDay: carData.pricePerDay,
        extraKmCharge: 12,
        includedKilometresPerDay: 300,
        securityDeposit: 2000,
        odometer: carData.odometer,
        locationCity: carData.locationCity,
        pickupAddress: `${carData.locationCity} Central Hub, SG Highway`,
        dropAddress: `${carData.locationCity} Central Hub, SG Highway`,
        features: JSON.stringify(['Bluetooth', 'CarPlay', 'Airbags', 'Reverse Camera', 'Fastag', 'Spare Tyre', 'USB Charger', 'Cruise Control']),
        registrationNumber: carData.registrationNumber,
        status: 'ACTIVE',
        reviewNote: 'Verified and approved for listing with all 8 photo angles inspected.',
        images: JSON.stringify(mediaList.map(m => '/api/media/' + m.id)),
      },
    });

    // Link media to vehicle
    await prisma.media.updateMany({
      where: { id: { in: mediaList.map(m => m.id) } },
      data: { vehicleId: vehicle.id },
    });

    // Create approved RC, Insurance, PUC documents
    const docExpiry = new Date('2028-12-31T23:59:59Z');
    for (const docKind of ['RC', 'INSURANCE', 'PUC']) {
      await prisma.document.create({
        data: {
          userId: host.id,
          vehicleId: vehicle.id,
          kind: docKind,
          status: 'APPROVED',
          source: 'HOST_UPLOAD',
          validUntil: docExpiry,
          reviewNote: `${docKind} verified and valid until 2028`,
        },
      });
    }

    console.log(`Car seeded & approved: ${carData.make} ${carData.model} (${carData.registrationNumber})`);
  }

  // 5. Seed a Sample Confirmed Booking for immediate testing of Admin, Host & Customer flows
  const firstCar = await prisma.vehicle.findFirst({ where: { status: 'ACTIVE' } });
  const existingBooking = await prisma.booking.findFirst({ where: { customerId: customer.id } });
  if (firstCar && !existingBooking) {
    const startDate = new Date(Date.now() + 3600 * 1000); // 1 hour from now (ready for Start Trip pickup inspection!)
    const endDate = new Date(Date.now() + 50 * 3600 * 1000); // ~2 days
    const rentalAmount = Number(firstCar.pricePerDay) * 2;
    const deposit = 2000;
    const total = rentalAmount + deposit;
    const sampleBooking = await prisma.booking.create({
      data: {
        bookingRef: 'SAF-2026-DEMO01',
        customerId: customer.id,
        vehicleId: firstCar.id,
        startDate,
        endDate,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
        totalAmount: total,
        securityDeposit: deposit,
        includedKilometres: 600,
        status: 'CONFIRMED',
        agreementAcceptedAt: new Date(),
        payment: {
          create: {
            amount: total,
            status: 'SUCCESS',
            gatewayRef: 'PAY-DEMO-001',
          },
        },
        invoice: {
          create: {
            invoiceNumber: 'INV-2026-0001',
            subtotal: rentalAmount,
            taxes: 0,
            totalAmount: total,
          },
        },
      },
    });
    console.log(`Sample booking created: ${sampleBooking.bookingRef} (${firstCar.make} ${firstCar.model})`);
  }

  console.log('\n======================================================');
  console.log('  ✅ POSTGRESQL + S3 TEST DATABASE READY!             ');
  console.log('======================================================');
  console.log('  Admin Login:    admin@safar.com    / Admin@12345678');
  console.log('  Host Login:     host@safar.com     / Host@12345678');
  console.log('  Customer Login: customer@safar.com / Customer@12345678');
  console.log('======================================================\n');
}

seed()
  .catch(e => {
    console.error('Seed failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
