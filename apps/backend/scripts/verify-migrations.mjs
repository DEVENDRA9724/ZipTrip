// Verifies the Phase 4B payout and Phase 6 vehicle approval migrations on disposable databases only (never DATABASE_URL, never portal.db):
//  1. PostgreSQL: applies every migration in prisma/postgresql/migrations to an in-memory PGlite (PostgreSQL in WASM),
//     with synthetic legacy payouts inserted before the new migration, then checks the backfill, constraints,
//     idempotency, schema parity and that rows written by the previous application version still insert.
//  2. SQLite: builds a pre-migration copy of the test fixture, adds legacy rows, applies `prisma db push` (the SQLite
//     workflow) to that temporary file and checks that every row survives with the safe default destination state.
//  3. Phase 6: the vehicle approval/availability backfill (PostgreSQL migration and the SQLite backfill script) on the
//     same synthetic cars, and the Option A relabel script on a synthetic database containing decoy documents.
// Usage: node scripts/verify-migrations.mjs   (or npm run db:verify-migrations)
import { readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));
const migrationsDir = join(root, 'prisma/postgresql/migrations');
const NEW_MIGRATION = '202610110001_payout_destination_security';
const VEHICLE_MIGRATION = '202610110002_vehicle_approval_availability';
const VEHICLE_COLUMNS = ['approvalStatus', 'availability', 'availabilityReason', 'approvedById', 'approvedAt', 'rejectedReason'];
const TS = '2026-10-01T00:00:00.000+00:00';

// Synthetic pre-Phase-6 cars covering every backfill branch, plus an upcoming booking that must stay untouched.
const vehicleFixture = () => {
  const car = (id, status) => `('${id}','vh-host','Make','Model',2022,'SUV','MANUAL','PETROL',5,1000,'${status}','Pune','[]','${TS}')`;
  const doc = (vehicle, kind, mediaId, source) => `('d-${vehicle}-${kind}','vh-host','${vehicle}','${kind}',${mediaId ? `'${mediaId}'` : 'NULL'},'APPROVED','${source}','2030-01-01T00:00:00.000+00:00','${TS}')`;
  const docs = (vehicle, mediaId, source) => ['RC', 'INSURANCE', 'PUC'].map((kind) => doc(vehicle, kind, mediaId, source));
  const approved = (vehicle, actor = 'vh-admin') => `('a-${vehicle}','${actor}','VEHICLE_ACTIVE','${vehicle}','{}','${TS}')`;
  return `
    INSERT INTO "User" ("id","email","passwordHash","firstName","lastName","role","updatedAt") VALUES
      ('vh-host','vhost@example.invalid','x','H','Ost','HOST','${TS}'), ('vh-admin','vadmin@example.invalid','x','A','Dmin','ADMIN','${TS}'),
      ('vh-cust','vcust@example.invalid','x','C','Ust','CUSTOMER','${TS}');
    INSERT INTO "Vehicle" ("id","hostId","make","model","year","category","transmission","fuelType","seats","pricePerDay","status","locationCity","images","updatedAt") VALUES
      ${[car('v-good', 'ACTIVE'), car('v-demo', 'ACTIVE'), car('v-unreviewed', 'ACTIVE'), car('v-host-only', 'ACTIVE'), car('v-maint', 'MAINTENANCE'), car('v-inactive', 'INACTIVE'), car('v-inactive-unreviewed', 'INACTIVE'), car('v-pending', 'PENDING_APPROVAL')].join(',')};
    INSERT INTO "Document" ("id","userId","vehicleId","kind","mediaId","status","source","validUntil","updatedAt") VALUES
      ${[...docs('v-good', 'm-1', 'UPLOAD'), ...docs('v-demo', null, 'DEMO_SEED'), ...docs('v-unreviewed', 'm-2', 'UPLOAD'), ...docs('v-host-only', 'm-3', 'UPLOAD')].join(',')};
    INSERT INTO "AuditLog" ("id","actorId","action","targetId","detail","createdAt") VALUES
      ${[approved('v-good'), approved('v-demo'), approved('v-host-only', 'vh-host'), approved('v-maint'), approved('v-inactive')].join(',')};
    INSERT INTO "Booking" ("id","bookingRef","customerId","vehicleId","startDate","endDate","totalAmount","status","updatedAt") VALUES
      ('b-upcoming','REF-1','vh-cust','v-demo','2030-01-01T00:00:00.000+00:00','2030-01-03T00:00:00.000+00:00',2000,'CONFIRMED','${TS}');`;
};
// [approvalStatus, availability, availabilityReason, legacy status]
const EXPECTED_VEHICLES = {
  'v-demo': ['PENDING_APPROVAL', 'INACTIVE', 'REVIEW_REQUIRED', 'PENDING_APPROVAL'],
  'v-good': ['APPROVED', 'ACTIVE', null, 'ACTIVE'],
  'v-host-only': ['PENDING_APPROVAL', 'INACTIVE', 'REVIEW_REQUIRED', 'PENDING_APPROVAL'],
  'v-inactive': ['APPROVED', 'INACTIVE', 'ADMIN_SUSPENDED', 'INACTIVE'],
  'v-inactive-unreviewed': ['PENDING_APPROVAL', 'INACTIVE', null, 'PENDING_APPROVAL'],
  'v-maint': ['APPROVED', 'INACTIVE', 'MAINTENANCE', 'MAINTENANCE'],
  'v-pending': ['PENDING_APPROVAL', 'INACTIVE', null, 'PENDING_APPROVAL'],
  'v-unreviewed': ['PENDING_APPROVAL', 'INACTIVE', 'REVIEW_REQUIRED', 'PENDING_APPROVAL'],
};
const vehicleStates = (rows) => Object.fromEntries(rows.map((r) => [r.id, [r.approvalStatus, r.availability, r.availabilityReason, r.status]]));
const VEHICLE_QUERY = `SELECT "id","approvalStatus","availability","availabilityReason","status","approvedById" FROM "Vehicle" WHERE "id" LIKE 'v-%' ORDER BY "id"`;
const results = [];
const check = (name, fn) => fn().then(() => results.push(['PASS', name]), (error) => { results.push(['FAIL', name, error.message]); });

const schema = readFileSync(join(root, 'prisma/schema.prisma'), 'utf8');
const modelColumns = (model) => {
  const block = schema.match(new RegExp(`model ${model} \\{([\\s\\S]*?)\\n\\}`))[1];
  return block.split('\n').map((line) => line.trim().split(/\s+/)).filter(([name, type]) => name && /^[a-z]/.test(name) && type && /^(String|Int|DateTime|Decimal|Boolean|Float)\??$/.test(type)).map(([name]) => name).sort();
};

async function postgres() {
  const { PGlite } = await import(pathToFileURL(require.resolve('@electric-sql/pglite')).href);
  const db = new PGlite();
  const migrations = readdirSync(migrationsDir).filter((name) => /^\d/.test(name)).sort();
  assert.equal(migrations.at(-1), VEHICLE_MIGRATION, 'vehicle migration must be the latest');
  assert.equal(migrations.at(-2), NEW_MIGRATION);
  for (const name of migrations.slice(0, -2)) await db.exec(readFileSync(join(migrationsDir, name, 'migration.sql'), 'utf8'));

  // Synthetic legacy data in the pre-Phase-4 shape.
  await db.exec(`
    INSERT INTO "User" ("id","email","passwordHash","firstName","lastName","role","updatedAt") VALUES
      ('u-host','host@example.invalid','x','H','Ost','HOST',now()), ('u-admin','admin@example.invalid','x','A','Dmin','ADMIN',now());
    INSERT INTO "PayoutAccount" ("id","userId","accountHolderName","bankName","accountNumberLast4","ifscCode","encryptedAccountNumber","status","updatedAt") VALUES
      ('acc-1','u-host','Legacy Host','Legacy Bank','4321','LEGC0001234','iv.tag.cipher','VERIFIED','2026-10-01T00:00:00Z');
    INSERT INTO "Payout" ("id","accountId","amount","status","reference","createdAt","processedAt") VALUES
      ('p-pending','acc-1',1000,'PENDING',NULL,'2026-10-02T00:00:00Z',NULL),
      ('p-processing','acc-1',2000,'PROCESSING','BATCH-9','2026-10-03T00:00:00Z',NULL),
      ('p-failed','acc-1',3000,'FAILED','RETURN-1','2026-10-04T00:00:00Z','2026-10-05T00:00:00Z'),
      ('p-paid','acc-1',4000,'PAID','UTR-OLD','2026-10-06T00:00:00Z','2026-10-07T00:00:00Z'),
      ('p-cancelled','acc-1',5000,'CANCELLED',NULL,'2026-10-08T00:00:00Z','2026-10-09T00:00:00Z');`);
  const before = (await db.query('SELECT "id","accountId","amount"::text,"status","reference","createdAt","processedAt" FROM "Payout" ORDER BY "id"')).rows;
  const migration = readFileSync(join(migrationsDir, NEW_MIGRATION, 'migration.sql'), 'utf8');
  await db.exec(migration);

  await check('postgres: legacy payouts keep id, amount, status, reference and timestamps', async () => {
    const after = (await db.query('SELECT "id","accountId","amount"::text,"status","reference","createdAt","processedAt" FROM "Payout" ORDER BY "id"')).rows;
    assert.deepEqual(after, before);
  });
  await check('postgres: open legacy payouts need reconciliation, final ones are LEGACY_UNVERIFIED, no destination is guessed', async () => {
    const rows = (await db.query('SELECT "id","destinationState","destinationEncryptedAccountNumber","destinationAccountNumberLast4","destinationCapturedAt" FROM "Payout" ORDER BY "id"')).rows;
    const state = Object.fromEntries(rows.map((r) => [r.id, r.destinationState]));
    assert.deepEqual(state, { 'p-cancelled': 'LEGACY_UNVERIFIED', 'p-failed': 'RECONCILIATION_REQUIRED', 'p-paid': 'LEGACY_UNVERIFIED', 'p-pending': 'RECONCILIATION_REQUIRED', 'p-processing': 'RECONCILIATION_REQUIRED' });
    assert.ok(rows.every((r) => r.destinationEncryptedAccountNumber === null && r.destinationAccountNumberLast4 === null && r.destinationCapturedAt === null));
  });
  await check('postgres: legacy accounts keep their status but need a revision-bound re-verification', async () => {
    const [account] = (await db.query('SELECT "status","revision","changedById","changedAt","verifiedRevision","reviewedById","fingerprint","encryptedAccountNumber" FROM "PayoutAccount"')).rows;
    assert.equal(account.status, 'VERIFIED');
    assert.equal(account.revision, 1);
    assert.equal(account.changedById, 'u-host');
    assert.ok(account.changedAt instanceof Date);
    assert.equal(account.verifiedRevision, null);
    assert.equal(account.reviewedById, null);
    assert.equal(account.encryptedAccountNumber, 'iv.tag.cipher');
  });
  await check('postgres: columns match the Prisma schema for Payout and PayoutAccount', async () => {
    for (const model of ['Payout', 'PayoutAccount']) {
      const columns = (await db.query('SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY column_name', [model])).rows.map((r) => r.column_name).sort();
      assert.deepEqual(columns, modelColumns(model), model);
    }
  });
  await check('postgres: indexes and foreign keys are present', async () => {
    const indexes = (await db.query(`SELECT indexname FROM pg_indexes WHERE tablename = 'Payout'`)).rows.map((r) => r.indexname);
    assert.ok(indexes.includes('Payout_destinationState_idx') && indexes.includes('Payout_accountId_status_idx'));
    await assert.rejects(db.query(`INSERT INTO "Payout" ("id","accountId","amount") VALUES ('orphan','missing-account',1)`), /foreign key/);
  });
  await check('postgres: re-running the migration is a no-op', async () => {
    const snapshot = JSON.stringify((await db.query('SELECT * FROM "Payout" ORDER BY "id"')).rows);
    await db.exec(migration);
    assert.equal(JSON.stringify((await db.query('SELECT * FROM "Payout" ORDER BY "id"')).rows), snapshot);
  });
  await check('postgres: rows written by the previous application version still insert and default to RECONCILIATION_REQUIRED', async () => {
    await db.query(`INSERT INTO "Payout" ("id","accountId","amount","status") VALUES ('old-app','acc-1',10,'PENDING')`);
    assert.equal((await db.query(`SELECT "destinationState" FROM "Payout" WHERE "id" = 'old-app'`)).rows[0].destinationState, 'RECONCILIATION_REQUIRED');
    await db.query(`UPDATE "PayoutAccount" SET "status" = 'PENDING' WHERE "id" = 'acc-1'`);
  });

  // Phase 6: vehicle approval and availability.
  await db.exec(vehicleFixture());
  const bookingBefore = JSON.stringify((await db.query('SELECT * FROM "Booking"')).rows);
  const vehicleMigration = readFileSync(join(migrationsDir, VEHICLE_MIGRATION, 'migration.sql'), 'utf8');
  await db.exec(vehicleMigration);
  await check('postgres: vehicle backfill approves only reviewed, evidenced cars; everything else waits for review', async () => {
    const rows = (await db.query(VEHICLE_QUERY)).rows;
    assert.deepEqual(vehicleStates(rows), EXPECTED_VEHICLES);
    assert.equal(rows.find((r) => r.id === 'v-good').approvedById, 'vh-admin');
    assert.ok(rows.filter((r) => r.approvalStatus !== 'APPROVED').every((r) => r.approvedById === null));
  });
  await check('postgres: one VEHICLE_STATUS_BACKFILLED audit row per car records the previous status', async () => {
    const audits = (await db.query(`SELECT "targetId","detail" FROM "AuditLog" WHERE "action" = 'VEHICLE_STATUS_BACKFILLED'`)).rows;
    assert.equal(audits.length, Object.keys(EXPECTED_VEHICLES).length);
    assert.equal(JSON.parse(audits.find((a) => a.targetId === 'v-demo').detail).previousStatus, 'ACTIVE');
  });
  await check('postgres: bookings are untouched by the vehicle migration', async () => assert.equal(JSON.stringify((await db.query('SELECT * FROM "Booking"')).rows), bookingBefore));
  await check('postgres: re-running the vehicle migration adds no audit rows and changes no car', async () => {
    const snapshot = JSON.stringify((await db.query('SELECT * FROM "Vehicle" ORDER BY "id"')).rows);
    const audits = (await db.query('SELECT COUNT(*)::int AS c FROM "AuditLog"')).rows[0].c;
    await db.exec(vehicleMigration);
    assert.equal(JSON.stringify((await db.query('SELECT * FROM "Vehicle" ORDER BY "id"')).rows), snapshot);
    assert.equal((await db.query('SELECT COUNT(*)::int AS c FROM "AuditLog"')).rows[0].c, audits);
  });
  await check('postgres: Vehicle columns and the approval/availability index match the Prisma schema', async () => {
    const columns = (await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'Vehicle' ORDER BY column_name`)).rows.map((r) => r.column_name).sort();
    assert.deepEqual(columns, [...modelColumns('Vehicle'), 'status'].sort()); // status is the VehicleStatus enum
    const indexes = (await db.query(`SELECT indexname FROM pg_indexes WHERE tablename = 'Vehicle'`)).rows.map((r) => r.indexname);
    assert.ok(indexes.includes('Vehicle_approvalStatus_availability_idx'));
  });
  await check('postgres: cars inserted by the previous application version default to DRAFT and INACTIVE', async () => {
    await db.query(`INSERT INTO "Vehicle" ("id","hostId","make","model","year","category","transmission","fuelType","seats","pricePerDay","locationCity","images","updatedAt") VALUES ('old-app-car','vh-host','M','M',2022,'SUV','MANUAL','PETROL',5,1,'Pune','[]',now())`);
    const row = (await db.query(`SELECT "approvalStatus","availability" FROM "Vehicle" WHERE "id" = 'old-app-car'`)).rows[0];
    assert.deepEqual(row, { approvalStatus: 'DRAFT', availability: 'INACTIVE' });
  });
  await db.close();
}

async function sqlite() {
  const Database = require('better-sqlite3');
  const directory = mkdtempSync(join(tmpdir(), 'safar-migration-'));
  try {
    const file = join(directory, 'legacy.db');
    // Pre-Phase-4 shape: the current fixture without the columns and index this migration adds.
    const added = [...VEHICLE_COLUMNS, 'revision', 'fingerprint', 'changedById', 'changedAt', 'reviewedById', 'reviewedAt', 'verifiedRevision', 'destinationState', 'destinationAccountHolderName', 'destinationBankName', 'destinationIfscCode', 'destinationAccountNumberLast4', 'destinationEncryptedAccountNumber', 'destinationFingerprint', 'destinationAccountRevision', 'destinationCapturedAt'];
    const legacyFixture = readFileSync(join(root, 'test/fixtures/sqlite-schema.sql'), 'utf8').split(/\r?\n/)
      .filter((line) => !added.some((column) => line.includes(`"${column}"`)) && !line.includes('Payout_destinationState_idx') && !line.includes('Vehicle_approvalStatus_availability_idx')).join('\n');
    const db = new Database(file);
    db.exec(legacyFixture);
    db.exec(`
      INSERT INTO "User" ("id","email","passwordHash","firstName","lastName","role","updatedAt") VALUES ('u-host','host@example.invalid','x','H','Ost','HOST',CURRENT_TIMESTAMP);
      INSERT INTO "PayoutAccount" ("id","userId","accountHolderName","bankName","accountNumberLast4","ifscCode","encryptedAccountNumber","status","updatedAt") VALUES ('acc-1','u-host','Legacy Host','Legacy Bank','4321','LEGC0001234','iv.tag.cipher','VERIFIED',CURRENT_TIMESTAMP);
      INSERT INTO "Payout" ("id","accountId","amount","status","reference") VALUES ('p-pending','acc-1',1000,'PENDING',NULL), ('p-paid','acc-1',4000,'PAID','UTR-OLD');`);
    const before = db.prepare('SELECT "id","amount","status","reference" FROM "Payout" ORDER BY "id"').all();
    db.exec(vehicleFixture());
    db.close();
    const push = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push'], { cwd: root, env: { ...process.env, DATABASE_URL: 'file:' + file }, encoding: 'utf8' });
    await check('sqlite: prisma db push applies the new columns to a legacy database without data loss prompts', async () => assert.equal(push.status, 0, (push.stdout + push.stderr).slice(-400)));
    const after = new Database(file, { readonly: true });
    await check('sqlite: legacy rows survive and receive the safe RECONCILIATION_REQUIRED default; nothing is captured', async () => {
      assert.deepEqual(after.prepare('SELECT "id","amount","status","reference" FROM "Payout" ORDER BY "id"').all(), before);
      assert.ok(after.prepare('SELECT * FROM "Payout"').all().every((r) => r.destinationState === 'RECONCILIATION_REQUIRED' && r.destinationEncryptedAccountNumber === null));
      const account = after.prepare('SELECT "status","revision","verifiedRevision" FROM "PayoutAccount"').get();
      assert.deepEqual(account, { status: 'VERIFIED', revision: 1, verifiedRevision: null });
    });
    await check('sqlite: the migrated database matches the test fixture used by the integration tests', async () => {
      const fixture = new Database(':memory:');
      fixture.exec(readFileSync(join(root, 'test/fixtures/sqlite-schema.sql'), 'utf8'));
      for (const table of ['Payout', 'PayoutAccount', 'Vehicle']) {
        const columns = (d) => d.prepare(`PRAGMA table_info("${table}")`).all().map((c) => `${c.name}:${c.type}:${c.notnull}:${c.dflt_value}`).sort();
        assert.deepEqual(columns(after), columns(fixture), table);
      }
      fixture.close();
    });
    after.close();
    const { backfillVehicleStatus } = require('./scripts/backfill-vehicle-status.cjs');
    const migrated = new Database(file);
    const bookingBefore = JSON.stringify(migrated.prepare('SELECT * FROM "Booking"').all());
    const backfilled = backfillVehicleStatus(migrated);
    await check('sqlite: the backfill script makes the same decisions as the PostgreSQL migration', async () => {
      assert.equal(backfilled.length, Object.keys(EXPECTED_VEHICLES).length);
      assert.deepEqual(vehicleStates(migrated.prepare(VEHICLE_QUERY).all()), EXPECTED_VEHICLES);
      assert.equal(JSON.stringify(migrated.prepare('SELECT * FROM "Booking"').all()), bookingBefore);
    });
    await check('sqlite: re-running the backfill script changes nothing and adds no audit rows', async () => {
      const snapshot = JSON.stringify(migrated.prepare('SELECT * FROM "Vehicle" ORDER BY "id"').all());
      const audits = migrated.prepare('SELECT COUNT(*) AS c FROM "AuditLog"').get().c;
      assert.equal(backfillVehicleStatus(migrated).length, 0);
      assert.equal(JSON.stringify(migrated.prepare('SELECT * FROM "Vehicle" ORDER BY "id"').all()), snapshot);
      assert.equal(migrated.prepare('SELECT COUNT(*) AS c FROM "AuditLog"').get().c, audits);
    });
    migrated.close();
    await relabel(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

// Option A relabel on a synthetic database: the 20 target records plus decoys that must never be touched.
async function relabel(directory) {
  const Database = require('better-sqlite3');
  const { relabelLegacyDemoDocuments, APPROVED_PREFIXES } = require('./scripts/relabel-legacy-demo-documents.cjs');
  const valid = '2030-01-01T00:00:00.000+00:00';
  const build = (name, extra = '') => {
    const db = new Database(join(directory, name));
    db.exec(readFileSync(join(root, 'test/fixtures/sqlite-schema.sql'), 'utf8'));
    db.exec(`INSERT INTO "User" ("id","email","passwordHash","firstName","lastName","role","isVerified","dlValidUntil","updatedAt") VALUES
      ('u-host','host@safar.com','x','H','Ost','HOST',0,NULL,'${TS}'), ('u-cust','customer@safar.com','x','C','Ust','CUSTOMER',1,'${valid}','${TS}'),
      ('u-real','real@example.invalid','x','R','Eal','CUSTOMER',1,'${valid}','${TS}');
      INSERT INTO "Vehicle" ("id","hostId","make","model","year","category","transmission","fuelType","seats","pricePerDay","status","locationCity","images","updatedAt","approvalStatus","availability")
        VALUES ('car-1','u-host','M','M',2022,'SUV','MANUAL','PETROL',5,1,'ACTIVE','Pune','[]','${TS}','APPROVED','ACTIVE');`);
    const insert = db.prepare(`INSERT INTO "Document" ("id","userId","vehicleId","kind","mediaId","status","source","validUntil","updatedAt") VALUES (?,?,?,?,?,?,?,?,?)`);
    APPROVED_PREFIXES.forEach((prefix, i) => {
      const personal = i >= 18;
      insert.run(prefix + '-0000-4000-8000-000000000000', personal ? 'u-cust' : 'u-host', personal ? null : 'car-1', personal ? (i === 18 ? 'AADHAAR' : 'DL') : ['RC', 'INSURANCE', 'PUC'][i % 3], null, 'APPROVED', 'DIGILOCKER_LIVE', valid, TS);
    });
    // Decoys: an evidenced document, a pending one, and another customer's approved record without evidence.
    insert.run('decoy-evidenced', 'u-host', 'car-1', 'RC', 'm-1', 'APPROVED', 'UPLOAD', valid, TS);
    insert.run('decoy-pending', 'u-host', 'car-1', 'PUC', null, 'PENDING', 'UPLOAD', null, TS);
    insert.run('decoy-real-dl', 'u-real', null, 'DL', null, 'APPROVED', 'DIGILOCKER_LIVE', valid, TS);
    if (extra) db.exec(extra);
    return db;
  };
  const decoys = (db) => JSON.stringify(db.prepare(`SELECT * FROM "Document" WHERE "id" LIKE 'decoy-%' ORDER BY "id"`).all());
  const db = build('relabel.db');
  const decoysBefore = decoys(db);
  const first = relabelLegacyDemoDocuments(db);
  await check('relabel: exactly the 20 listed records become DEMO_SEED; status, history and decoys are preserved', async () => {
    assert.equal(first.relabelled.length, 20);
    const targets = db.prepare(`SELECT * FROM "Document" WHERE "id" NOT LIKE 'decoy-%'`).all();
    assert.ok(targets.every((d) => d.source === 'DEMO_SEED' && d.status === 'APPROVED' && /unverified/i.test(d.reviewNote)));
    assert.equal(decoys(db), decoysBefore);
    const audits = db.prepare(`SELECT "detail" FROM "AuditLog" WHERE "action" = 'DOCUMENT_RELABELLED_DEMO'`).all();
    assert.equal(audits.length, 20);
    assert.ok(audits.every((a) => JSON.parse(a.detail).previousSource === 'DIGILOCKER_LIVE'));
  });
  await check('relabel: the demo customer loses verification; other customers keep it; the affected car returns to review', async () => {
    assert.deepEqual(db.prepare(`SELECT "isVerified","dlValidUntil" FROM "User" WHERE "id" = 'u-cust'`).get(), { isVerified: 0, dlValidUntil: null });
    assert.equal(db.prepare(`SELECT "isVerified" FROM "User" WHERE "id" = 'u-real'`).get().isVerified, 1);
    assert.equal(db.prepare(`SELECT "approvalStatus" FROM "Vehicle" WHERE "id" = 'car-1'`).get().approvalStatus, 'PENDING_APPROVAL');
    assert.equal(JSON.parse(db.prepare(`SELECT "detail" FROM "AuditLog" WHERE "action" = 'USER_VERIFICATION_RECOMPUTED'`).get().detail).previous.isVerified, true);
  });
  await check('relabel: a second run changes nothing and adds no audit rows', async () => {
    const audits = db.prepare('SELECT COUNT(*) AS c FROM "AuditLog"').get().c;
    const snapshot = JSON.stringify([db.prepare('SELECT * FROM "Document" ORDER BY "id"').all(), db.prepare('SELECT * FROM "User" ORDER BY "id"').all(), db.prepare('SELECT * FROM "Vehicle"').all()]);
    const second = relabelLegacyDemoDocuments(db);
    assert.equal(second.relabelled.length, 0);
    assert.equal(second.alreadyRelabelled.length, 20);
    assert.equal(db.prepare('SELECT COUNT(*) AS c FROM "AuditLog"').get().c, audits);
    assert.equal(JSON.stringify([db.prepare('SELECT * FROM "Document" ORDER BY "id"').all(), db.prepare('SELECT * FROM "User" ORDER BY "id"').all(), db.prepare('SELECT * FROM "Vehicle"').all()]), snapshot);
  });
  db.close();
  await check('relabel: aborts without changes when a prefix is ambiguous, missing or owned by a non-seed account', async () => {
    for (const [name, extra] of [
      ['ambiguous.db', `INSERT INTO "Document" ("id","userId","kind","status","source","updatedAt") VALUES ('${APPROVED_PREFIXES[0]}-dup','u-host','RC','APPROVED','UPLOAD','${TS}')`],
      ['missing.db', `UPDATE "Document" SET "mediaId" = 'm-9' WHERE "id" LIKE '${APPROVED_PREFIXES[1]}%'`],
      ['foreign.db', `UPDATE "Document" SET "userId" = 'u-real' WHERE "id" LIKE '${APPROVED_PREFIXES[2]}%'`],
    ]) {
      const other = build(name, extra);
      const before = JSON.stringify(other.prepare('SELECT * FROM "Document" ORDER BY "id"').all());
      assert.throws(() => relabelLegacyDemoDocuments(other), /Aborted without changes/, name);
      assert.equal(JSON.stringify(other.prepare('SELECT * FROM "Document" ORDER BY "id"').all()), before, name);
      assert.equal(other.prepare('SELECT COUNT(*) AS c FROM "AuditLog"').get().c, 0, name);
      other.close();
    }
  });
}

await postgres();
await sqlite();
for (const [status, name, detail] of results) console.log(`${status}  ${name}${detail ? `\n      ${detail}` : ''}`);
const failed = results.filter(([status]) => status === 'FAIL').length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
