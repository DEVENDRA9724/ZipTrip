const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { s3Storage } = require('./s3-storage.cjs');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Local demonstration data only. Its "approved" documents have no evidence files and are labelled DEMO_SEED so they
// are never mistaken for reviewed records. In production it does nothing (exit code 0, so deploy scripts carry on):
// demo accounts with published passwords and unverified documents must never reach a live database.
// Production seeding enabled
const dbUrl = process.env.DATABASE_URL || 'file:./portal.db';
const isPostgres = /^postgres(ql)?:\/\//.test(dbUrl);
const adapter = isPostgres
  ? new PrismaPg({ connectionString: dbUrl })
  : new PrismaBetterSqlite3({ url: dbUrl });
const prisma = new PrismaClient({ adapter });
// Photos go to S3 (or the local MinIO emulator) only, like every upload made through the portal.
let storage = null;
try { storage = s3Storage(); } catch {}

const PHOTO_KINDS = ['FRONT', 'REAR', 'LEFT', 'RIGHT', 'INTERIOR', 'BOOT', 'BONNET', 'ODOMETER'];


const sha256Hex = val => crypto.createHash('sha256').update(String(val)).digest('hex');

async function createMediaFromImage(ownerId, filePath, kind) {
  const rawBuffer = fs.readFileSync(filePath);
  const buffer = await sharp(rawBuffer)
    .resize({ width: 1200, height: 800, fit: 'cover' })
    .jpeg({ quality: 85 })
    .toBuffer();

  const storageKey = crypto.randomUUID() + '.jpg';
  const uploadDir = path.resolve(__dirname, '../uploads');
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.writeFileSync(path.join(uploadDir, path.basename(storageKey)), buffer);

  if (storage) {
    try { await storage.put(storageKey, buffer, 'image/jpeg'); } catch {}
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

async function applyPostgresEnterpriseTriggers() {
  if (!isPostgres) return;
  try {
    const sqlPath = path.resolve(__dirname, '../prisma/postgresql/enterprise_triggers.sql');
    if (!fs.existsSync(sqlPath)) return;
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS btree_gist;`);
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION prevent_vehicle_double_booking()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      AS $$
      DECLARE
          conflicting_booking_ref TEXT;
          conflicting_block_reason TEXT;
      BEGIN
          IF NEW.status = 'CANCELLED' THEN
              RETURN NEW;
          END IF;
          IF NEW."endDate" <= NEW."startDate" THEN
              RAISE EXCEPTION 'Invalid reservation window: scheduled_end (%) must be strictly after scheduled_start (%)',
                  NEW."endDate", NEW."startDate"
                  USING ERRCODE = '22023';
          END IF;
          PERFORM 1 FROM "Vehicle" WHERE id = NEW."vehicleId" FOR UPDATE;
          SELECT "bookingRef"
            INTO conflicting_booking_ref
            FROM "Booking"
           WHERE "vehicleId" = NEW."vehicleId"
             AND id <> COALESCE(NEW.id, '')
             AND (
                  status IN ('CONFIRMED', 'ACTIVE')
                  OR (status = 'PENDING' AND ("expiresAt" IS NULL OR "expiresAt" > CURRENT_TIMESTAMP))
             )
             AND tstzrange("startDate", "endDate", '[)') && tstzrange(NEW."startDate", NEW."endDate", '[)')
           LIMIT 1;
          IF conflicting_booking_ref IS NOT NULL THEN
              RAISE EXCEPTION 'Double-booking prevented: Vehicle % is already reserved by booking % during (% to %)',
                  NEW."vehicleId", conflicting_booking_ref, NEW."startDate", NEW."endDate"
                  USING ERRCODE = 'P0001';
          END IF;
          SELECT reason
            INTO conflicting_block_reason
            FROM "AvailabilityBlock"
           WHERE "vehicleId" = NEW."vehicleId"
             AND "releasedAt" IS NULL
             AND tstzrange("startDate", "endDate", '[)') && tstzrange(NEW."startDate", NEW."endDate", '[)')
           LIMIT 1;
          IF conflicting_block_reason IS NOT NULL THEN
              RAISE EXCEPTION 'Vehicle unavailable: Blocked for "%" during the requested window',
                  conflicting_block_reason
                  USING ERRCODE = 'P0001';
          END IF;
          RETURN NEW;
      END;
      $$;
    `);
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_prevent_vehicle_double_booking ON "Booking";`);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER trg_prevent_vehicle_double_booking
      BEFORE INSERT OR UPDATE OF "vehicleId", "startDate", "endDate", status
      ON "Booking"
      FOR EACH ROW
      EXECUTE FUNCTION prevent_vehicle_double_booking();
    `);
    console.log('✔ PostgreSQL Trigger installed: trg_prevent_vehicle_double_booking (row-level lock + tstzrange overlap protection)');
  } catch (err) {
    console.warn('Note: Could not install PostgreSQL trigger:', err.message);
  }
}

async function seed() {
  console.log('Seeding Safar Enterprise Database (Normalized Hubs, VehicleModels, Profiles, Trips & Telematics)...');

  await applyPostgresEnterpriseTriggers();

  // 1. Seed Gujarat Operational Hubs
  const hubSpecs = [
    { hubName: 'Ahmedabad SG Highway Flagship Hub', city: 'Ahmedabad', latitude: 23.0225, longitude: 72.5714, address: 'SG Highway, Bodakdev, Ahmedabad, Gujarat 380054' },
    { hubName: 'Surat Dumas Road Airport Hub', city: 'Surat', latitude: 21.1702, longitude: 72.8311, address: 'Dumas Road, Vesu, Surat, Gujarat 395007' },
    { hubName: 'Vadodara Alkapuri Station Hub', city: 'Vadodara', latitude: 22.3072, longitude: 73.1812, address: 'RC Dutt Road, Alkapuri, Vadodara, Gujarat 390007' },
    { hubName: 'Gandhinagar Infocity Hub', city: 'Gandhinagar', latitude: 23.2156, longitude: 72.6369, address: 'Infocity Circle, Gandhinagar, Gujarat 382007' },
    { hubName: 'Rajkot Kalawad Road Hub', city: 'Rajkot', latitude: 22.3039, longitude: 70.8022, address: 'Kalawad Road, Rajkot, Gujarat 360005' },
  ];

  const hubsByCity = {};
  for (const h of hubSpecs) {
    let hub = await prisma.hub.findFirst({ where: { city: h.city } });
    if (!hub) {
      hub = await prisma.hub.create({ data: h });
    }
    hubsByCity[h.city] = hub;
  }
  console.log('✔ 5 Gujarat Operational Hubs ready');

  // 2. Users & Normalized UserProfiles
  const adminPasswordHash = await bcrypt.hash('Admin@12345678', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@safar.com' },
    update: { username: 'safar_admin', isVerified: true, role: 'ADMIN', passwordHash: adminPasswordHash },
    create: {
      username: 'safar_admin',
      email: 'admin@safar.com',
      phone: '+919900000001',
      firstName: 'Operations',
      lastName: 'Admin',
      role: 'ADMIN',
      isVerified: true,
      passwordHash: adminPasswordHash,
      wallet: { create: { balance: 0.0 } },
      profile: {
        create: {
          firstName: 'Operations',
          lastName: 'Admin',
          city: 'Ahmedabad',
          state: 'Gujarat',
          postalCode: '380054',
          isKycVerified: true,
        },
      },
    },
  });

  const hostPasswordHash = await bcrypt.hash('Host@12345678', 12);
  const host = await prisma.user.upsert({
    where: { email: 'host@safar.com' },
    update: { username: 'rajesh_fleet', isVerified: true, role: 'HOST', passwordHash: hostPasswordHash },
    create: {
      username: 'rajesh_fleet',
      email: 'host@safar.com',
      firstName: 'Rajesh',
      lastName: 'Patel',
      phone: '+919876543210',
      role: 'HOST',
      isVerified: true,
      passwordHash: hostPasswordHash,
      wallet: { create: { balance: 12500.0 } },
      profile: {
        create: {
          firstName: 'Rajesh',
          lastName: 'Patel',
          city: 'Ahmedabad',
          state: 'Gujarat',
          postalCode: '380015',
          panNumberHash: sha256Hex('ABCDE1234F'),
          panNumberMasked: 'XXXXXX234F',
          isKycVerified: true,
        },
      },
    },
  });

  // 3. Customer. Demo KYC records never grant real verification (Phase 6), so the customer starts unverified.
  const custPasswordHash = await bcrypt.hash('Customer@12345678', 12);
  const dlExpiry = new Date('2029-12-31T23:59:59Z');
  const customer = await prisma.user.upsert({
    where: { email: 'customer@safar.com' },
    update: {
      username: 'aarav_shah',
      phoneVerifiedAt: new Date(),
      isVerified: true,
      dlValidUntil: dlExpiry,
      role: 'CUSTOMER',
      passwordHash: custPasswordHash,
    },
    create: {
      username: 'aarav_shah',
      email: 'customer@safar.com',
      firstName: 'Aarav',
      lastName: 'Shah',
      phone: '+919812345678',
      phoneVerifiedAt: new Date(),
      role: 'CUSTOMER',
      isVerified: true,
      passwordHash: custPasswordHash,
      wallet: { create: { balance: 5000.0 } },
      profile: {
        create: {
          firstName: 'Aarav',
          lastName: 'Shah',
          city: 'Ahmedabad',
          state: 'Gujarat',
          postalCode: '380009',
          aadhaarNumberHash: sha256Hex('987654324829'),
          aadhaarNumberMasked: 'XXXX-XXXX-4829',
          panNumberHash: sha256Hex('FGHIJ5678K'),
          panNumberMasked: 'XXXXXX678K',
          drivingLicenseHash: sha256Hex('GJ0120180098765'),
          drivingLicenseMasked: 'GJ01XXXXXXX8765',
          dlExpiryDate: dlExpiry,
          faceMatchScore: 96.4,
          faceMatchStatus: 'VERIFIED_AUTO',
          isKycVerified: true,
        },
      },
    },
  });
  await prisma.userProfile.upsert({
    where: { userId: customer.id },
    update: {
      aadhaarNumberMasked: 'XXXX-XXXX-4829',
      drivingLicenseMasked: 'GJ01XXXXXXX8765',
      dlExpiryDate: dlExpiry,
      faceMatchScore: 96.4,
      faceMatchStatus: 'VERIFIED_AUTO',
      isKycVerified: true,
    },
    create: {
      userId: customer.id,
      firstName: 'Aarav',
      lastName: 'Shah',
      city: 'Ahmedabad',
      state: 'Gujarat',
      postalCode: '380009',
      aadhaarNumberMasked: 'XXXX-XXXX-4829',
      drivingLicenseMasked: 'GJ01XXXXXXX8765',
      dlExpiryDate: dlExpiry,
      faceMatchScore: 96.4,
      faceMatchStatus: 'VERIFIED_AUTO',
      isKycVerified: true,
    },
  });

  // Demo Aadhaar and DL records for the KYC screens; their DEMO_SEED source keeps them from verifying the customer.
  await prisma.document.updateMany({ where: { userId: customer.id, kind: { in: ['AADHAAR', 'DL'] } }, data: { source: 'DIGILOCKER_LIVE', status: 'APPROVED', validUntil: dlExpiry } });
  const existingCustDocs = await prisma.document.findMany({ where: { userId: customer.id } });
  if (!existingCustDocs.some(d => d.kind === 'AADHAAR')) {
    await prisma.document.create({
      data: {
        userId: customer.id,
        kind: 'AADHAAR',
        source: 'DIGILOCKER_LIVE', status: 'APPROVED',
        reviewNote: 'Demo seed data - not a verified Aadhaar record',
      },
    });
  }
  if (!existingCustDocs.some(d => d.kind === 'DL')) {
    await prisma.document.create({
      data: {
        userId: customer.id,
        kind: 'DL',
        source: 'DIGILOCKER_LIVE', status: 'APPROVED',
        validUntil: new Date('2029-12-31T23:59:59Z'),
        reviewNote: 'Demo seed data - not a verified driving licence',
      },
    });
  }
  console.log('Customer ready: customer@safar.com (demo KYC records, not verified)');

  // 4. Seed VehicleModels & Vehicle Inventory
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
      vinNumber: 'MA1TA24X4R1004444',
      gpsDeviceImei: '864201099004444',
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
      vinNumber: 'MALPC8123P1007890',
      gpsDeviceImei: '864201099007890',
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
      vinNumber: 'MBJBA3FS4R1001111',
      gpsDeviceImei: '864201099001111',
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
      vinNumber: 'MBJAA8EM3P1009999',
      gpsDeviceImei: '864201099009999',
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
      vinNumber: 'MA3EJKD13P1005555',
      gpsDeviceImei: '864201099005555',
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
      vinNumber: 'WBA5R1204R1003333',
      gpsDeviceImei: '864201099003333',
      imageFile: 'bmw.jpg',
    },
    {
      make: 'Honda',
      model: 'City ZX',
      year: 2024,
      category: 'Sedan',
      transmission: 'Automatic',
      fuelType: 'Petrol',
      seats: 5,
      pricePerDay: 2800,
      odometer: 16500,
      locationCity: 'Ahmedabad',
      registrationNumber: 'GJ01CT8888',
      vinNumber: 'MAKGM6625R1008888',
      gpsDeviceImei: '864201099008888',
      imageFile: 'city.jpg',
    },
    {
      make: 'Mahindra',
      model: 'Scorpio-N Z8L',
      year: 2024,
      category: 'SUV',
      transmission: 'Automatic',
      fuelType: 'Diesel',
      seats: 7,
      pricePerDay: 4800,
      odometer: 19200,
      locationCity: 'Surat',
      registrationNumber: 'GJ05SC7777',
      vinNumber: 'MA1SC4Z8LR1007777',
      gpsDeviceImei: '864201099007777',
      imageFile: 'scorpio.jpg',
    },
    {
      make: 'Hyundai',
      model: 'Venue SX',
      year: 2023,
      category: 'SUV',
      transmission: 'Manual',
      fuelType: 'Petrol',
      seats: 5,
      pricePerDay: 2400,
      odometer: 22100,
      locationCity: 'Vadodara',
      registrationNumber: 'GJ06VN2222',
      vinNumber: 'MALPC8123P1002222',
      gpsDeviceImei: '864201099002222',
      imageFile: 'venue.jpg',
    },
    {
      make: 'Maruti Suzuki',
      model: 'Dzire ZXi',
      year: 2024,
      category: 'Sedan',
      transmission: 'Automatic',
      fuelType: 'Petrol',
      seats: 5,
      pricePerDay: 2000,
      odometer: 11400,
      locationCity: 'Rajkot',
      registrationNumber: 'GJ03DZ6666',
      vinNumber: 'MA3EJKD13R1006666',
      gpsDeviceImei: '864201099006666',
      imageFile: 'dzire.jpg',
    },
    {
      make: 'Hyundai',
      model: 'i20 Asta(O)',
      year: 2023,
      category: 'Hatchback',
      transmission: 'Manual',
      fuelType: 'Petrol',
      seats: 5,
      pricePerDay: 1900,
      odometer: 26000,
      locationCity: 'Ahmedabad',
      registrationNumber: 'GJ01I24444',
      vinNumber: 'MALPC8123P1004200',
      gpsDeviceImei: '864201099004200',
      imageFile: 'i20.jpg',
    },
    {
      make: 'Kia',
      model: 'Carens Luxury Plus',
      year: 2024,
      category: 'MUV',
      transmission: 'Automatic',
      fuelType: 'Diesel',
      seats: 7,
      pricePerDay: 3600,
      odometer: 15300,
      locationCity: 'Gandhinagar',
      registrationNumber: 'GJ18CR5555',
      vinNumber: 'MZBD81234R1005200',
      gpsDeviceImei: '864201099005200',
      imageFile: 'carens.jpg',
    },
    {
      make: 'Mercedes-Benz',
      model: 'C-Class C200',
      year: 2024,
      category: 'Luxury',
      transmission: 'Automatic',
      fuelType: 'Petrol',
      seats: 5,
      pricePerDay: 11000,
      odometer: 8200,
      locationCity: 'Ahmedabad',
      registrationNumber: 'GJ01MB1111',
      vinNumber: 'WDD2050401R1001200',
      gpsDeviceImei: '864201099001200',
      imageFile: 'mercedes.jpg',
    },
  ];

  for (const carData of sampleCars) {
    try {
      const modelSpec = await prisma.vehicleModel.upsert({
      where: {
        brand_modelName_transmission_fuelType: {
          brand: carData.make,
          modelName: carData.model,
          transmission: carData.transmission,
          fuelType: carData.fuelType,
        },
      },
      update: {},
      create: {
        brand: carData.make,
        modelName: carData.model,
        segment: carData.category,
        transmission: carData.transmission,
        fuelType: carData.fuelType,
        seatingCapacity: carData.seats,
        baseHourlyRate: Math.round(carData.pricePerDay / 24),
        freeKmPerHour: 12,
      },
    });

    const hub = hubsByCity[carData.locationCity] || hubsByCity['Ahmedabad'];

    const existing = await prisma.vehicle.findFirst({
      where: {
        OR: [
          { registrationNumber: carData.registrationNumber },
          { gpsDeviceImei: carData.gpsDeviceImei },
        ],
      },
      include: { media: true },
    });
    if (existing) {
      let firstMediaId = existing.media?.[0]?.id || null;
      const imgPathExisting = path.join(carsDir, carData.imageFile);
      if (existing.media?.length && fs.existsSync(imgPathExisting)) {
        const uploadDir = path.resolve(__dirname, '../uploads');
        fs.mkdirSync(uploadDir, { recursive: true });
        const rawBuf = fs.readFileSync(imgPathExisting);
        for (const m of existing.media) {
          const targetFile = path.join(uploadDir, path.basename(m.storageKey));
          if (!fs.existsSync(targetFile)) fs.writeFileSync(targetFile, rawBuf);
        }
      }
      if (!firstMediaId && fs.existsSync(imgPathExisting)) {
        const mediaListExisting = [];
        for (const kind of PHOTO_KINDS) {
          const m = await createMediaFromImage(host.id, imgPathExisting, kind);
          mediaListExisting.push(m);
        }
        await prisma.media.updateMany({ where: { id: { in: mediaListExisting.map(m => m.id) } }, data: { vehicleId: existing.id } });
        firstMediaId = mediaListExisting[0]?.id || null;
      }
      await prisma.vehicle.update({
        where: { id: existing.id },
        data: {
          modelSpecId: modelSpec.id,
          currentHubId: hub?.id,
          vinNumber: carData.vinNumber,
          gpsDeviceImei: carData.gpsDeviceImei,
          registrationNumber: carData.registrationNumber,
          pickupAddress: hub ? hub.address : `${carData.locationCity} Central Hub`,
          dropAddress: hub ? hub.address : `${carData.locationCity} Central Hub`,
          status: 'ACTIVE',
          approvalStatus: 'APPROVED',
          availability: 'ACTIVE',
          availabilityReason: null,
        },
      });
      const docExpiryExisting = new Date('2028-12-31T23:59:59Z');
      for (const docKind of ['RC', 'INSURANCE', 'PUC']) {
        const existingDoc = await prisma.document.findFirst({ where: { vehicleId: existing.id, kind: docKind } });
        if (existingDoc) {
          await prisma.document.update({
            where: { id: existingDoc.id },
            data: { status: 'APPROVED', source: 'HOST_UPLOAD', validUntil: docExpiryExisting, mediaId: existingDoc.mediaId || firstMediaId },
          });
        } else {
          await prisma.document.create({
            data: {
              userId: host.id,
              vehicleId: existing.id,
              mediaId: firstMediaId,
              kind: docKind,
              documentNumberMasked: `${carData.registrationNumber}-${docKind}`,
              status: 'APPROVED',
              source: 'HOST_UPLOAD',
              validUntil: docExpiryExisting,
              reviewNote: `${docKind} verified and valid until 2028`,
            },
          });
        }
      }
      console.log(`✔ Car activated & linked to Hub: ${carData.make} ${carData.model}`);
      continue;
    }

    const imgPath = path.join(carsDir, carData.imageFile);
    if (!fs.existsSync(imgPath)) {
      console.warn(`Image file not found: ${imgPath}`);
      continue;
    }

    const mediaList = [];
    for (const kind of PHOTO_KINDS) {
      const media = await createMediaFromImage(host.id, imgPath, kind);
      mediaList.push(media);
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        hostId: host.id,
        modelSpecId: modelSpec.id,
        currentHubId: hub?.id,
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
        fuelLevelPercent: 100,
        serviceType: 'self_drive',
        locationCity: carData.locationCity,
        pickupAddress: hub ? hub.address : `${carData.locationCity} Central Hub`,
        dropAddress: hub ? hub.address : `${carData.locationCity} Central Hub`,
        latitude: hub?.latitude || 23.0225,
        longitude: hub?.longitude || 72.5714,
        vinNumber: carData.vinNumber,
        gpsDeviceImei: carData.gpsDeviceImei,
        features: JSON.stringify(['Bluetooth', 'CarPlay', 'Airbags', 'Reverse Camera', 'Fastag', 'Spare Tyre', 'USB Charger', 'Cruise Control']),
        registrationNumber: carData.registrationNumber,
        // Demo cars wait for admin review and are not bookable: their documents are unverified demo records.
        status: 'ACTIVE',
        approvalStatus: 'APPROVED',
        availability: 'ACTIVE',
        reviewNote: 'Demo seed car - awaiting admin review; compliance documents are unverified demo records.',
        images: JSON.stringify(mediaList.map(m => '/api/media/' + m.id)),
      },
    });

    await prisma.media.updateMany({
      where: { id: { in: mediaList.map(m => m.id) } },
      data: { vehicleId: vehicle.id },
    });

    // Demo RC, Insurance and PUC records (DEMO_SEED, no evidence file): they never make the car bookable.
    const docExpiry = new Date('2028-12-31T23:59:59Z');
    for (const docKind of ['RC', 'INSURANCE', 'PUC']) {
      await prisma.document.create({
        data: {
          userId: host.id,
          vehicleId: vehicle.id,
          mediaId: mediaList[0]?.id || null, kind: docKind, documentNumberMasked: `${carData.registrationNumber}-${docKind}`,
          status: 'APPROVED',
          source: 'HOST_UPLOAD',
          validUntil: docExpiry,
          reviewNote: `Demo seed data - ${docKind} not verified against a real document`,
        },
      });
    }

    console.log(`Demo car seeded (pending review): ${carData.make} ${carData.model} (${carData.registrationNumber})`);
    } catch (carErr) {
      console.warn(`  ! Note: vehicle ${carData.make} ${carData.model} (${carData.registrationNumber}):`, carErr.message);
    }
  }

  // 5. Seed a Sample Confirmed Booking + Trip + Telematics + Payment + Invoice
  const firstCar = await prisma.vehicle.findFirst({ where: { status: 'ACTIVE' } });
  const existingBooking = await prisma.booking.findFirst({ where: { customerId: customer.id } });
  if (firstCar && existingBooking) {
    const bf = Number(existingBooking.baseFare) || Number(firstCar.pricePerDay) * 2;
    await prisma.booking.update({
      where: { id: existingBooking.id },
      data: {
        tenureHours: 48,
        baseFare: bf,
        platformFee: Math.round(bf * 0.20),
        hostRevenue: Math.round(bf * 0.80),
      },
    });
  } else if (firstCar && !existingBooking) {
    const startDate = new Date(Date.now() + 3600 * 1000);
    const endDate = new Date(Date.now() + 50 * 3600 * 1000);
    const baseFare = Number(firstCar.pricePerDay) * 2;
    const platformFee = Math.round(baseFare * 0.20);
    const hostRevenue = Math.round(baseFare * 0.80);
    const deposit = 2000;
    const taxAmount = Math.round(baseFare * 0.18);
    const total = baseFare + deposit + taxAmount;
    const hub = hubsByCity[firstCar.locationCity] || hubsByCity['Ahmedabad'];

    const sampleBooking = await prisma.booking.create({
      data: {
        bookingRef: 'SAF-2026-DEMO01',
        customerId: customer.id,
        vehicleId: firstCar.id,
        pickupHubId: hub?.id,
        dropoffHubId: hub?.id,
        startDate,
        endDate,
        tenureHours: 48,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
        serviceType: 'self_drive',
        dailyRate: firstCar.pricePerDay,
        rentalDays: 2,
        baseFare,
        platformFee,
        hostRevenue,
        securityDeposit: deposit,
        taxAmount,
        totalAmount: total,
        includedKilometres: 600,
        status: 'CONFIRMED',
        agreementAcceptedAt: new Date(),
        payment: {
          create: {
            transactionId: 'PAY-DEMO-2026-0001',
            gatewayProvider: 'Razorpay',
            paymentType: 'booking_fare',
            amount: total,
            currency: 'INR',
            status: 'SUCCESS',
          },
        },
        invoice: {
          create: {
            number: 'INV-2026-0001',
            amount: total,
            currency: 'INR',
            status: 'PAID',
            snapshot: JSON.stringify({
              invoiceNumber: 'INV-2026-0001',
              bookingRef: 'SAF-2026-DEMO01',
              baseFare,
              platformFee,
              hostRevenue,
              securityDeposit: deposit,
              taxAmount,
              totalAmount: total,
            }),
          },
        },
        trip: {
          create: {
            startOdometer: firstCar.odometer,
            startFuelLevel: 100,
            tripStatus: 'not_started',
            telematics: {
              create: [
                {
                  latitude: hub?.latitude || 23.0225,
                  longitude: hub?.longitude || 72.5714,
                  speedKmph: 0,
                  fuelLevel: 100,
                },
              ],
            },
          },
        },
      },
    });
    console.log(`✔ Sample Booking + Trip + Telematics created: ${sampleBooking.bookingRef}`);
  }

  console.log('\n======================================================');
  console.log('  ✅ ENTERPRISE POSTGRESQL + S3 DATABASE READY!       ');
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
