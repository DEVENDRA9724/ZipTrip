// Starts the compiled backend for Playwright against a throwaway SQLite database seeded with synthetic data.
// Everything (database, generated keys, state file) lives in SAFAR_PW_DIR (uploads stay in memory) under the OS temp folder; the
// developer's apps/backend/.env and portal.db are never read because the process runs from that temp folder.
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '../../..');
const backend = path.join(root, 'apps', 'backend');
const load = (name) => require(require.resolve(name, { paths: [backend] }));
const dir = process.env.SAFAR_PW_DIR;
const port = Number(process.env.SAFAR_PW_PORT || 3100);

if (!dir || !path.resolve(dir).startsWith(path.resolve(os.tmpdir()))) throw new Error('SAFAR_PW_DIR must be a folder inside the OS temp directory');
if (!fs.existsSync(path.join(backend, 'dist', 'main.js'))) throw new Error('Build the backend first: npm --prefix apps/backend run build');

const PASSWORD = 'Playwright-Only-Pass-1'; // synthetic, test database only
const USERS = {
  admin: { id: 'pw-admin', email: 'admin@playwright.invalid', role: 'ADMIN', firstName: 'Ada', lastName: 'Admin' },
  customer: { id: 'pw-customer', email: 'customer@playwright.invalid', role: 'CUSTOMER', firstName: 'Cara', lastName: 'Customer', verified: true },
  customer2: { id: 'pw-customer2', email: 'customer2@playwright.invalid', role: 'CUSTOMER', firstName: 'Cody', lastName: 'Customer', verified: true },
  hostA: { id: 'pw-host-a', email: 'host-a@playwright.invalid', role: 'HOST', firstName: 'Hana', lastName: 'HostA' },
  hostB: { id: 'pw-host-b', email: 'host-b@playwright.invalid', role: 'HOST', firstName: 'Hugo', lastName: 'HostB' },
  dealer: { id: 'pw-dealer', email: 'dealer@playwright.invalid', role: 'DEALER', firstName: 'Dina', lastName: 'Dealer' },
  admin2: { id: 'pw-admin2', email: 'admin2@playwright.invalid', role: 'ADMIN', firstName: 'Abe', lastName: 'Admin' },
  blockme: { id: 'pw-blockme', email: 'blockme@playwright.invalid', role: 'HOST', firstName: 'Bo', lastName: 'Blocked' },
};
// Hostile values for the image-URL and markup-escaping tests. They are inserted directly because the API now rejects them.
const XSS_IMAGES = JSON.stringify([
  'https://evil.example.test/a.jpg" onerror="window.__xss=\'attr\'',
  'javascript:window.__xss=\'js\'',
  'data:image/svg+xml,<svg onload="window.__xss=\'svg\'">',
]);
const VEHICLES = [
  { id: 'pw-car-a', hostId: 'pw-host-a', make: 'Hyundai', model: 'Creta PW', city: 'Ahmedabad', status: 'ACTIVE', photos: true, docs: true, registrationNumber: 'GJ01PW0001' },
  { id: 'pw-car-a2', hostId: 'pw-host-a', make: 'Maruti', model: 'Swift PW', city: 'Ahmedabad', status: 'PENDING_APPROVAL', photos: true, registrationNumber: 'GJ01PW0002' },
  { id: 'pw-car-b', hostId: 'pw-host-b', make: 'Mahindra', model: 'Thar PW', city: 'Surat', status: 'ACTIVE', photos: true, docs: true, registrationNumber: 'GJ05PW0003' },
  { id: 'pw-car-d', hostId: 'pw-dealer', make: 'Toyota', model: 'Innova PW', city: 'Vadodara', status: 'PENDING_APPROVAL', photos: true, registrationNumber: 'GJ06PW0004' },
  { id: 'pw-car-xss', hostId: 'pw-host-b', make: '<img src=x onerror="window.__xss=\'make\'">', model: 'Injection PW', city: 'Ahmedabad', status: 'ACTIVE', docs: true, images: XSS_IMAGES, registrationNumber: 'GJ01PW0005' },
  { id: 'pw-car-https', hostId: 'pw-host-b', make: 'Kia', model: 'Seltos PW', city: 'Surat', status: 'ACTIVE', docs: true, images: '["https://images.example.test/car.png"]', registrationNumber: 'GJ05PW0006' },
  // Active listing whose front photo record has no file on disk: exercises the image fallback and safe 500 errors.
  { id: 'pw-car-missing', hostId: 'pw-host-b', make: 'Tata', model: 'Nexon PW', city: 'Surat', status: 'ACTIVE', docs: true, missingFront: true, registrationNumber: 'GJ05PW0008' },
  { id: 'pw-car-http', hostId: 'pw-host-b', make: 'Honda', model: 'City PW', city: 'Surat', status: 'ACTIVE', docs: true, images: '["http://images.example.test/car.png"]', registrationNumber: 'GJ05PW0007' },
  // Legacy-style car awaiting review whose approved documents are unverified demo records without evidence files.
  { id: 'pw-car-legacy', hostId: 'pw-host-b', make: 'Skoda', model: 'Kushaq PW', city: 'Surat', status: 'PENDING_APPROVAL', photos: true, demoDocs: true, registrationNumber: 'GJ05PW0009' },
];
const PHOTO_KINDS = ['FRONT', 'REAR', 'LEFT', 'RIGHT', 'INTERIOR', 'BOOT', 'BONNET', 'ODOMETER'];

async function seed(dbUrl, storage) {
  const { PrismaClient } = load('@prisma/client');
  const { PrismaBetterSqlite3 } = load('@prisma/adapter-better-sqlite3');
  const bcrypt = load('bcryptjs');
  const sharp = load('sharp');
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: dbUrl }) });
  const passwordHash = await bcrypt.hash(PASSWORD, 4);
  const year = 365 * 86400000;
  for (const u of Object.values(USERS)) {
    await prisma.user.create({ data: { id: u.id, email: u.email, passwordHash, firstName: u.firstName, lastName: u.lastName, role: u.role, isVerified: Boolean(u.verified), dlValidUntil: u.verified ? new Date(Date.now() + 2 * year) : null } });
  }
  const photo = await sharp({ create: { width: 320, height: 200, channels: 3, background: '#e8dff0' } }).jpeg().toBuffer();
  for (const v of VEHICLES) {
    await prisma.vehicle.create({ data: { id: v.id, hostId: v.hostId, make: v.make, model: v.model, year: 2024, category: 'SUV', transmission: 'Automatic', fuelType: 'Petrol', seats: 5, pricePerDay: 2000, status: v.status,
      // Phase 6: ACTIVE fixtures are approved and accepting bookings; pending ones await review.
      approvalStatus: v.status === 'ACTIVE' ? 'APPROVED' : 'PENDING_APPROVAL', availability: v.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE', locationCity: v.city, registrationNumber: v.registrationNumber, images: v.images || '[]' } });
    if (v.photos) for (const kind of PHOTO_KINDS) {
      const storageKey = crypto.randomUUID() + '.jpg';
      await storage.put(storageKey, photo, 'image/jpeg');
      await prisma.media.create({ data: { ownerId: v.hostId, vehicleId: v.id, kind, storageKey, mimeType: 'image/jpeg', size: photo.length, sha256: crypto.createHash('sha256').update(storageKey).digest('hex') } });
    }
    if (v.missingFront) await prisma.media.create({ data: { id: 'pw-missing-media', ownerId: v.hostId, vehicleId: v.id, kind: 'FRONT', storageKey: 'missing-in-storage.jpg', mimeType: 'image/jpeg', size: 1, sha256: 'missing' } });
    if (v.docs) for (const kind of ['RC', 'INSURANCE', 'PUC']) {
      // Compliance only counts with an evidence file, so each approved document gets one.
      const storageKey = crypto.randomUUID() + '.jpg';
      await storage.put(storageKey, photo, 'image/jpeg');
      const evidence = await prisma.media.create({ data: { ownerId: v.hostId, kind, storageKey, mimeType: 'image/jpeg', size: photo.length, sha256: crypto.createHash('sha256').update(storageKey).digest('hex') } });
      await prisma.document.create({ data: { userId: v.hostId, vehicleId: v.id, kind, mediaId: evidence.id, status: 'APPROVED', source: 'UPLOAD', reviewNote: 'Seeded for browser tests', validUntil: new Date(Date.now() + year) } });
    }
    if (v.demoDocs) for (const kind of ['RC', 'INSURANCE', 'PUC']) {
      await prisma.document.create({ data: { userId: v.hostId, vehicleId: v.id, kind, status: 'APPROVED', source: 'DEMO_SEED', reviewNote: 'Demo seed data - unverified', validUntil: new Date(Date.now() + year) } });
    }
  }
  await prisma.$disconnect();
}

(async () => {
  fs.mkdirSync(dir, { recursive: true });
  const dbFile = path.join(dir, 'playwright.db');
  fs.rmSync(dbFile, { force: true });
  const Database = load('better-sqlite3');
  const db = new Database(dbFile);
  db.exec(fs.readFileSync(path.join(backend, 'test', 'fixtures', 'sqlite-schema.sql'), 'utf8'));
  db.close();
  const dbUrl = 'file:' + dbFile;
  // Uploads live in object storage only; the browser tests use the in-memory store inside this same process.
  const { memoryObjectStorage } = require(path.join(backend, 'dist', 'media', 'object-storage.js'));
  await seed(dbUrl, memoryObjectStorage());

  const baseURL = `http://127.0.0.1:${port}`;
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify({ baseURL, password: PASSWORD, users: USERS, vehicles: VEHICLES.map(({ id, hostId, make, model, city, status }) => ({ id, hostId, make, model, city, status })) }, null, 2));

  Object.assign(process.env, {
    NODE_ENV: 'development',
    PORT: String(port),
    DATABASE_URL: dbUrl,
    MEDIA_STORAGE: 'memory',
    WEB_ORIGIN: `${baseURL},http://localhost:${port}`,
    JWT_SECRET: crypto.randomBytes(48).toString('hex'),
    DOCUMENT_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'),
    SANDBOX_ENV: 'test', SANDBOX_API_KEY: '', SANDBOX_API_SECRET: '', KYC_REDIRECT_URL: '',
    BUSINESS_PHONE: '', BUSINESS_EMAIL: '', BUSINESS_ADDRESS: '',
    AGREEMENT_PYTHON: path.join(dir, 'no-python-in-browser-tests'),
  });
  process.chdir(dir);
  require(path.join(backend, 'dist', 'main.js'));
})().catch((error) => { console.error(error); process.exit(1); });
