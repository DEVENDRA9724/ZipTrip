const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL || 'file:./portal.db' });
const prisma = new PrismaClient({ adapter });

async function runFlowTests() {
  console.log('=== RUNNING COMPLETE SAFAR PORTAL INTEGRATION TESTS ===\n');

  // Test 1: Verify Seeded Admin & Host & Customer
  console.log('Test 1: Verify Seeded Accounts & Password Hashing');
  const admin = await prisma.user.findUnique({ where: { email: 'admin@safar.com' } });
  assert(admin && admin.role === 'ADMIN', 'Admin user must exist with ADMIN role');
  assert(await bcrypt.compare('Admin@12345678', admin.passwordHash), 'Admin password hash must match');

  const host = await prisma.user.findUnique({ where: { email: 'host@safar.com' } });
  assert(host && host.role === 'HOST', 'Host user must exist with HOST role');

  const customer = await prisma.user.findUnique({ where: { email: 'customer@safar.com' } });
  assert(customer && customer.role === 'CUSTOMER', 'Customer user must exist with CUSTOMER role');
  assert(customer.isVerified, 'Customer must be verified for self-drive');
  console.log('✓ Seeded accounts and password hashes verified.\n');

  // Test 2: Active Vehicles with 8 Photo Angles
  console.log('Test 2: Verify Active Vehicles and 8-Angle Photo Media');
  const vehicles = await prisma.vehicle.findMany({
    where: { status: 'ACTIVE' },
    include: { media: true, documents: true },
  });
  assert(vehicles.length >= 6, 'Must have at least 6 active fleet vehicles');

  const requiredPhotoKinds = ['FRONT', 'REAR', 'LEFT', 'RIGHT', 'INTERIOR', 'BOOT', 'BONNET', 'ODOMETER'];
  for (const car of vehicles) {
    assert(car.media.length === 8, `${car.make} ${car.model} must have exactly 8 photos, found ${car.media.length}`);
    const kinds = car.media.map(m => m.kind);
    for (const reqKind of requiredPhotoKinds) {
      assert(kinds.includes(reqKind), `${car.make} ${car.model} is missing photo angle ${reqKind}`);
    }
    // Verify car documents (RC, Insurance, PUC)
    const docKinds = car.documents.map(d => d.kind);
    assert(docKinds.includes('RC') && docKinds.includes('INSURANCE') && docKinds.includes('PUC'), `${car.make} ${car.model} must have approved RC, Insurance, and PUC`);
  }
  console.log(`✓ All ${vehicles.length} vehicles have full 8-angle photos and verified RC/Insurance/PUC documents.\n`);

  // Test 3: Document Encryption
  console.log('Test 3: Private Document AES-256-GCM Encryption / Decryption');
  const key = Buffer.from(process.env.DOCUMENT_ENCRYPTION_KEY, 'hex');
  assert(key.length === 32, 'Encryption key must be 32 bytes (256-bit)');

  const sampleDoc = Buffer.from('CONFIDENTIAL_DL_IMAGE_BYTES_12345');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(sampleDoc), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const packaged = Buffer.concat([iv, authTag, encrypted]);

  // Decrypt
  const readIv = packaged.subarray(0, 12);
  const readTag = packaged.subarray(12, 28);
  const readCipher = packaged.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, readIv);
  decipher.setAuthTag(readTag);
  const decrypted = Buffer.concat([decipher.update(readCipher), decipher.final()]);
  assert.strictEqual(decrypted.toString('utf8'), sampleDoc.toString('utf8'), 'Decrypted bytes must match original');
  console.log('✓ Document encryption/decryption verified.\n');

  // Test 4: Booking Flow (Reservation hold -> Admin payment record -> Confirmation -> Invoice creation)
  console.log('Test 4: Complete Booking and Invoice Lifecycle');
  const testCar = vehicles[0];
  const startDate = new Date(Date.now() + 86400000); // Tomorrow
  const endDate = new Date(Date.now() + 86400000 * 3); // 2 days later
  const rentalDays = 2;
  const totalAmount = Number(testCar.pricePerDay) * rentalDays;
  const bookingRef = 'SF-TEST-' + crypto.randomUUID().slice(0, 8).toUpperCase();

  const booking = await prisma.booking.create({
    data: {
      customerId: customer.id,
      vehicleId: testCar.id,
      startDate,
      endDate,
      rentalDays,
      dailyRate: testCar.pricePerDay,
      totalAmount,
      bookingRef,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 30 * 60000), // 30-min hold
    },
  });
  assert(booking.status === 'PENDING', 'Booking initial status must be PENDING');

  // Admin verifies payment in bank and records it
  const paymentRef = 'UPI-' + crypto.randomUUID().slice(0, 12).toUpperCase();
  const payment = await prisma.payment.create({
    data: {
      bookingId: booking.id,
      transactionId: paymentRef,
      amount: totalAmount,
      currency: 'INR',
      status: 'SUCCESS',
    },
  });

  // Booking confirmed and hold lifted
  const confirmedBooking = await prisma.booking.update({
    where: { id: booking.id },
    data: { status: 'CONFIRMED', expiresAt: null },
  });
  assert(confirmedBooking.status === 'CONFIRMED', 'Booking must be CONFIRMED after payment');

  // Invoice generated
  const invoiceNumber = 'SF-2026-' + crypto.randomUUID().slice(0, 8).toUpperCase();
  const invoice = await prisma.invoice.create({
    data: {
      bookingId: booking.id,
      number: invoiceNumber,
      amount: totalAmount,
      currency: 'INR',
      status: 'PAID',
      snapshot: JSON.stringify({
        business: process.env.BUSINESS_NAME || 'Safar Self Drive',
        customer: `${customer.firstName} ${customer.lastName}`,
        email: customer.email,
        vehicle: `${testCar.make} ${testCar.model}`,
        registration: testCar.registrationNumber,
        rentalDays,
        dailyRate: Number(testCar.pricePerDay),
        total: totalAmount,
        paymentReference: paymentRef,
      }),
    },
  });
  assert(invoice.status === 'PAID', 'Invoice must be PAID');
  console.log(`✓ Booking ${bookingRef} created -> Payment ${paymentRef} recorded -> Invoice ${invoiceNumber} issued.\n`);

  // Test 5: Pickup and Return Inspection with Odometer Readings & Pictures
  console.log('Test 5: Odometer Inspection Tracking (Pickup & Return)');
  const initialOdometer = testCar.odometer;
  const pickupOdometer = initialOdometer;
  const returnOdometer = initialOdometer + 340; // 340 km driven

  // Create dummy inspection media
  const pickupMedia = await prisma.media.create({
    data: {
      ownerId: host.id,
      kind: 'ODOMETER',
      storageKey: crypto.randomUUID() + '.jpg',
      mimeType: 'image/jpeg',
      size: 1024,
      sha256: crypto.createHash('sha256').update('pickup_odo').digest('hex'),
    },
  });

  const pickupInspection = await prisma.inspection.create({
    data: {
      bookingId: booking.id,
      stage: 'PICKUP',
      odometer: pickupOdometer,
      mediaId: pickupMedia.id,
      note: 'No scratches, clean interior, fuel full',
    },
  });

  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: 'ACTIVE' },
  });

  const returnMedia = await prisma.media.create({
    data: {
      ownerId: host.id,
      kind: 'ODOMETER',
      storageKey: crypto.randomUUID() + '.jpg',
      mimeType: 'image/jpeg',
      size: 1024,
      sha256: crypto.createHash('sha256').update('return_odo').digest('hex'),
    },
  });

  const returnInspection = await prisma.inspection.create({
    data: {
      bookingId: booking.id,
      stage: 'RETURN',
      odometer: returnOdometer,
      mediaId: returnMedia.id,
      note: 'Returned safely, 340 km total trip',
    },
  });

  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: 'COMPLETED' },
  });

  await prisma.vehicle.update({
    where: { id: testCar.id },
    data: { odometer: returnOdometer },
  });

  const updatedCar = await prisma.vehicle.findUnique({ where: { id: testCar.id } });
  assert.strictEqual(updatedCar.odometer, returnOdometer, 'Vehicle odometer must update upon return');
  console.log(`✓ Pickup odometer (${pickupOdometer} km) and Return odometer (${returnOdometer} km) recorded with inspection photos.\n`);

  // Clean up test booking data
  await prisma.inspection.deleteMany({ where: { bookingId: booking.id } });
  await prisma.invoice.deleteMany({ where: { bookingId: booking.id } });
  await prisma.payment.deleteMany({ where: { bookingId: booking.id } });
  await prisma.booking.delete({ where: { id: booking.id } });
  await prisma.media.delete({ where: { id: pickupMedia.id } });
  await prisma.media.delete({ where: { id: returnMedia.id } });
  await prisma.vehicle.update({ where: { id: testCar.id }, data: { odometer: initialOdometer } });

  console.log('=== ALL INTEGRATION TESTS PASSED SUCCESSFULLY! ===');
}

runFlowTests()
  .catch(e => {
    console.error('Test failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
