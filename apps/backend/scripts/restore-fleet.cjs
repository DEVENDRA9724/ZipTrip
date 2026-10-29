// Restore a private fleet export into an existing database without overwriting accounts/listings.
// node --env-file=.env scripts/restore-fleet.cjs <restore-folder> [--apply]
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
class RestoreError extends Error {}
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function converter(Prisma) {
  const models = Object.fromEntries(Prisma.dmmf.datamodel.models.map(m => [m.name, m]));
  return (model, row) => {
    const data = {};
    for (const field of models[model].fields.filter(f => f.kind === 'scalar' || f.kind === 'enum')) {
      const value = row[field.name];
      if (value === undefined) continue;
      data[field.name] = value === null ? null : field.type === 'DateTime' ? new Date(value)
        : field.type === 'Boolean' ? Boolean(value) : ['Int', 'Float'].includes(field.type) ? Number(value)
        : field.type === 'Decimal' ? String(value) : value;
    }
    return data;
  };
}

async function planFleet(prisma, data) {
  if (data.format !== 'safar-fleet-v1' || !Array.isArray(data.vehicles) || !data.vehicles.length) throw new RestoreError('Invalid fleet export.');
  for (const rows of [data.vehicles, data.owners, data.models, data.hubs, data.media, data.documents]) {
    if (!Array.isArray(rows) || rows.some(r => !r.id) || new Set(rows.map(r => r.id)).size !== rows.length) throw new RestoreError('Invalid or duplicate source records.');
  }
  const vehicles = [], skipped = [];
  for (const row of data.vehicles) {
    const existing = await prisma.vehicle.findFirst({ where: { OR: [
      { id: row.id }, ...(row.registrationNumber ? [{ registrationNumber: row.registrationNumber }] : []),
    ] } });
    if (existing) { skipped.push(row.id); continue; }
    vehicles.push(row);
  }
  const ownerMap = new Map(), newOwners = [];
  for (const row of data.owners.filter(o => vehicles.some(v => v.hostId === o.id))) {
    const email = String(row.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !['HOST', 'DEALER'].includes(row.role)) throw new RestoreError('Source owner must be an existing host/dealer record with a valid email.');
    const byId = await prisma.user.findUnique({ where: { id: row.id } });
    const existing = await prisma.user.findUnique({ where: { email } });
    if (byId && byId.id !== existing?.id) throw new RestoreError('Owner ID conflicts with another account; nothing was restored.');
    if (existing && !['HOST', 'DEALER', 'ADMIN'].includes(existing.role)) throw new RestoreError('An existing owner email belongs to a customer. No role was changed.');
    ownerMap.set(row.id, existing?.id || row.id);
    if (!existing) newOwners.push({ ...row, email });
  }
  if (vehicles.some(v => !ownerMap.has(v.hostId))) throw new RestoreError('A vehicle has no matching source owner.');
  return { vehicles, skipped, ownerMap, newOwners };
}

async function restoreFleet({ prisma, data, apply, convert, hashPassword, storage, readMedia, writeCredentials }) {
  const plan = await planFleet(prisma, data);
  const ids = new Set(plan.vehicles.map(v => v.id));
  const media = data.media.filter(m => ids.has(m.vehicleId));
  const summary = { dryRun: !apply, sourceVehicles: data.vehicles.length, vehiclesToRestore: plan.vehicles.length,
    existingVehiclesUnchanged: plan.skipped.length, ownersToCreate: plan.newOwners.length,
    photosToRestore: media.length, documentRecordsToReview: data.documents.filter(d => ids.has(d.vehicleId)).length,
    resultingState: 'PENDING_APPROVAL / INACTIVE; upload and review actual RC, Insurance and PUC evidence before activation' };
  // Check the entire photo package before uploading anything or changing the database.
  const files = new Map();
  for (const row of media) {
    if (!/^[a-f0-9-]+\.jpg$/i.test(row.storageKey) || !['FRONT', 'REAR', 'LEFT', 'RIGHT', 'INTERIOR', 'BOOT', 'BONNET', 'ODOMETER'].includes(row.kind)) throw new RestoreError('Unexpected source media path or type.');
    const bytes = await readMedia(row.storageKey);
    if (bytes.length !== row.size || sha256(bytes) !== row.sha256) throw new RestoreError('A photo is missing or its checksum does not match. Nothing was restored.');
    files.set(row.id, bytes);
  }
  if (!apply || !plan.vehicles.length) return summary;
  if (!storage) throw new RestoreError('Configure the existing private S3 bucket before applying the restore.');
  // Preserve existing S3 objects. Repeating a failed restore can reuse verified uploads.
  for (const row of media) {
    const existing = await storage.get(row.storageKey);
    if (existing && sha256(existing) !== row.sha256) throw new RestoreError('An existing S3 object has different content. Nothing was overwritten.');
    if (!existing) await storage.put(row.storageKey, files.get(row.id), row.mimeType);
    const check = await storage.get(row.storageKey);
    if (!check || sha256(check) !== row.sha256) throw new RestoreError('S3 photo verification failed. Database restore was not started.');
  }
  const credentials = [];
  await prisma.$transaction(async tx => {
    for (const row of plan.newOwners) {
      const password = crypto.randomBytes(24).toString('base64url');
      await tx.user.create({ data: { id: row.id, email: row.email, firstName: row.firstName, lastName: row.lastName,
        role: row.role, passwordHash: await hashPassword(password), isVerified: false, isBlocked: Boolean(row.isBlocked), wallet: { create: {} } } });
      credentials.push({ email: row.email, role: row.role, password });
    }
    const modelIds = new Set(plan.vehicles.map(v => v.modelSpecId).filter(Boolean));
    const hubIds = new Set(plan.vehicles.map(v => v.currentHubId).filter(Boolean));
    const modelMap = new Map();
    for (const row of data.models.filter(r => modelIds.has(r.id))) {
      const existing = await tx.vehicleModel.findUnique({ where: { id: row.id } })
        || await tx.vehicleModel.findFirst({ where: { brand: row.brand, modelName: row.modelName, transmission: row.transmission, fuelType: row.fuelType } });
      if (!existing) await tx.vehicleModel.create({ data: convert('VehicleModel', row) });
      modelMap.set(row.id, existing?.id || row.id);
    }
    for (const row of data.hubs.filter(r => hubIds.has(r.id))) if (!await tx.hub.findUnique({ where: { id: row.id } })) await tx.hub.create({ data: convert('Hub', row) });
    for (const row of plan.vehicles) {
      await tx.vehicle.create({ data: convert('Vehicle', { ...row, hostId: plan.ownerMap.get(row.hostId),
        modelSpecId: row.modelSpecId ? modelMap.get(row.modelSpecId) : null,
        status: 'PENDING_APPROVAL', approvalStatus: 'PENDING_APPROVAL', availability: 'INACTIVE', availabilityReason: 'REVIEW_REQUIRED',
        reviewNote: 'Restored from the previous local fleet; document evidence must be reviewed before activation.' }) });
    }
    for (const row of media) await tx.media.create({ data: convert('Media', { ...row, ownerId: plan.ownerMap.get(row.ownerId) || plan.ownerMap.get(plan.vehicles.find(v => v.id === row.vehicleId).hostId) }) });
    for (const row of data.documents.filter(d => ids.has(d.vehicleId))) {
      if (!['RC', 'INSURANCE', 'PUC'].includes(row.kind)) continue;
      await tx.document.create({ data: { id: row.id, userId: plan.ownerMap.get(row.userId), vehicleId: row.vehicleId,
        kind: row.kind, status: 'PENDING', source: 'LEGACY_IMPORT', mediaId: null,
        validUntil: row.validUntil ? new Date(row.validUntil) : null,
        reviewNote: 'Previous document record had no uploaded evidence file. Upload the actual document for review.' } });
    }
    await tx.auditLog.create({ data: { actorId: 'system:fleet-restore', action: 'FLEET_RESTORED', targetId: 'previous-local-fleet',
      detail: JSON.stringify({ restoredVehicleIds: plan.vehicles.map(v => v.id), skippedExisting: plan.skipped.length, priorCredentialsPreserved: true }) } });
    if (credentials.length) await writeCredentials(credentials);
  }, { timeout: 120000 });
  return { ...summary, restoredVehicles: plan.vehicles.length };
}

async function main() {
  const dir = process.argv[2] && path.resolve(process.argv[2]);
  if (!dir) throw new RestoreError('Usage: node --env-file=.env scripts/restore-fleet.cjs <restore-folder> [--apply]');
  const url = /^postgres(ql)?:\/\//.test(process.env.POSTGRES_DATABASE_URL || '') ? process.env.POSTGRES_DATABASE_URL : process.env.DATABASE_URL;
  if (!/^postgres(ql)?:\/\//.test(url || '')) throw new RestoreError('Use the existing PostgreSQL server .env. SQLite is a source backup only.');
  const data = JSON.parse(fs.readFileSync(path.join(dir, 'fleet.json'), 'utf8'));
  const { PrismaClient, Prisma } = require('@prisma/client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const bcrypt = require('bcryptjs');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }), log: [] });
  const apply = process.argv.includes('--apply');
  const passwordFile = path.resolve('fleet-owner-passwords-' + Date.now() + '.json');
  try {
    const result = await restoreFleet({ prisma, data, apply, convert: converter(Prisma), hashPassword: value => bcrypt.hash(value, 12),
      storage: apply ? require('./s3-storage.cjs').s3Storage() : null,
      readMedia: key => fs.readFileSync(path.join(dir, 'uploads', key)),
      writeCredentials: rows => fs.writeFileSync(passwordFile, JSON.stringify(rows, null, 2), { mode: 0o600, flag: 'wx' }) });
    console.log(JSON.stringify(result, null, 2));
    if (apply && fs.existsSync(passwordFile)) console.log('New owner credentials saved privately to: ' + passwordFile + '. Existing account passwords were unchanged.');
  } finally { await prisma.$disconnect(); }
}
if (require.main === module) main().catch(error => {
  console.error(error instanceof RestoreError ? error.message : 'Fleet restore failed. Check the export, database schema, and S3 connection. No existing accounts or vehicles were overwritten.');
  const code = String(error?.code || error?.name || '');
  if (!(error instanceof RestoreError) && /^[A-Za-z0-9_]+$/.test(code)) console.error('Failure code: ' + code);
  process.exitCode = 1;
});
module.exports = { restoreFleet, planFleet, converter };
