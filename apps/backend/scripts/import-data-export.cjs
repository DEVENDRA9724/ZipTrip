// Imports a JSON export of the local SQLite data into the production database (PostgreSQL), in one transaction.
//   - Only into an empty database (no users yet), so nothing in production is overwritten.
//   - Every account gets a new random password, written to --passwords <file> (mode 600) and never printed; the
//     export carries no password hashes.
//   - Demo documents (DEMO_SEED) never count in production, so accounts start unverified and imported cars return to
//     pending review until real documents are approved. Each change is written to the audit log with previous values.
//   - Values are converted to the production column types from the Prisma schema.
// Usage: node scripts/import-data-export.cjs <export.json> --passwords <file> [--dry-run]
'use strict';
const { readFileSync, writeFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');
const { randomBytes, randomUUID } = require('node:crypto');

const ORDER = ['User', 'Wallet', 'Vehicle', 'Media', 'Document', 'Booking', 'Notification', 'AuditLog'];
const ACTOR = 'system:data-import';
const delegate = (name) => name[0].toLowerCase() + name.slice(1);

function converter(Prisma) {
  const models = Object.fromEntries(Prisma.dmmf.datamodel.models.map((m) => [m.name, m]));
  return (model, row) => {
    const fields = Object.fromEntries(models[model].fields.filter((f) => f.kind === 'scalar' || f.kind === 'enum').map((f) => [f.name, f]));
    const data = {};
    for (const [key, value] of Object.entries(row)) {
      const field = fields[key];
      if (!field) continue; // columns the production schema does not have
      if (value === null || value === undefined) { data[key] = null; continue; }
      if (field.type === 'DateTime') data[key] = new Date(value);
      else if (field.type === 'Boolean') data[key] = value === true || value === 1 || value === '1';
      else if (field.type === 'Int') data[key] = Number(value);
      else if (field.type === 'Float') data[key] = Number(value);
      else if (field.type === 'Decimal') data[key] = String(value);
      else data[key] = value;
    }
    return data;
  };
}

async function importData({ prisma, Prisma, bcrypt, exported, dryRun }) {
  const convert = converter(Prisma);
  const passwords = [];
  const counts = {};
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    if (await tx.user.count()) throw new Error('The production database already has users; nothing was imported.');
    for (const model of ORDER) {
      const rows = exported.tables[model] || [];
      const data = [];
      for (const row of rows) {
        const item = convert(model, row);
        if (model === 'User') {
          const password = randomBytes(15).toString('base64url');
          passwords.push([item.email, item.role, password]);
          item.passwordHash = await bcrypt.hash(password, 12);
          item.otpCodeHash = null;
          item.otpExpiresAt = null;
          item.isVerified = false;
          item.dlValidUntil = null;
        }
        if (model === 'Vehicle') Object.assign(item, { approvalStatus: 'PENDING_APPROVAL', availability: 'INACTIVE', availabilityReason: 'REVIEW_REQUIRED', status: 'PENDING_APPROVAL' });
        data.push(item);
      }
      if (data.length) await tx[delegate(model)].createMany({ data });
      counts[model] = data.length;
    }
    const audits = [
      ...(exported.tables.User || []).map((u) => ({ id: randomUUID(), actorId: ACTOR, action: 'USER_VERIFICATION_RECOMPUTED', targetId: u.id, createdAt: now,
        detail: JSON.stringify({ previous: { isVerified: Boolean(u.isVerified), dlValidUntil: u.dlValidUntil }, isVerified: false, dlValidUntil: null, reason: 'Imported to production: demo documents do not count' }) })),
      ...(exported.tables.Vehicle || []).map((v) => ({ id: randomUUID(), actorId: ACTOR, action: 'VEHICLE_APPROVAL_REVOKED', targetId: v.id, createdAt: now,
        detail: JSON.stringify({ previous: { approvalStatus: v.approvalStatus, availability: v.availability }, approvalStatus: 'PENDING_APPROVAL', availability: 'INACTIVE', availabilityReason: 'REVIEW_REQUIRED', reason: 'Imported to production: approved on demo documents; needs review of real RC, Insurance and PUC' }) })),
    ];
    await tx.auditLog.createMany({ data: audits });
    counts.importAuditRows = audits.length;
    if (dryRun) throw Object.assign(new Error('dry run'), { dryRun: true });
  }, { timeout: 60000 }).catch((error) => { if (!error.dryRun) throw error; });
  return { counts, passwords, dryRun };
}

async function main(argv = process.argv) {
  require('dotenv').config({ path: resolve(__dirname, '../.env'), quiet: true });
  const file = argv[2];
  const pi = argv.indexOf('--passwords');
  const passwordFile = pi > 0 ? argv[pi + 1] : '';
  const dryRun = argv.includes('--dry-run');
  if (!file || !existsSync(file)) throw new Error('Usage: node scripts/import-data-export.cjs <export.json> --passwords <file> [--dry-run]');
  if (!dryRun && (!passwordFile || existsSync(passwordFile))) throw new Error('Give a new --passwords file path (it must not exist yet).');
  const { PrismaClient, Prisma } = require('@prisma/client');
  const url = process.env.DATABASE_URL || '';
  if (!/^postgres(ql)?:\/\//.test(url)) throw new Error('DATABASE_URL must be the production PostgreSQL database.');
  const prisma = new PrismaClient({ adapter: new (require('@prisma/adapter-pg').PrismaPg)({ connectionString: url }) });
  try {
    const result = await importData({ prisma, Prisma, bcrypt: require('bcryptjs'), exported: JSON.parse(readFileSync(file, 'utf8')), dryRun });
    if (!dryRun) {
      writeFileSync(passwordFile, ['Safar production accounts (new passwords; the old published ones no longer work)', 'Login: http://13.202.48.156/auth.html', '',
        ...result.passwords.map(([email, role, password]) => `${role.padEnd(9)} ${email}  ${password}`), ''].join('\n'), { mode: 0o600 });
    }
    console.log(JSON.stringify({ dryRun, imported: result.counts, accounts: result.passwords.map(([email, role]) => `${role} ${email}`), passwordsWrittenTo: dryRun ? null : passwordFile }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exit(1); });

module.exports = { importData };
