// Moves every uploaded file into the folder layout (see scripts/media-folders.cjs): vehicles/…, documents/…, kyc/…,
// inspections/…, below S3_PREFIX. Works with the SQLite or PostgreSQL database in DATABASE_URL.
//
// For each media record whose key is not in a folder yet, the file is found in its current place:
//   1. S3 at S3_PREFIX + key (this project's flat layout);
//   2. S3 at the exact key, or under --legacy-prefix (main's earlier "safar-media/<id>.jpg" records);
//   3. the server's local uploads folder (main's earlier disk fallback).
// It is copied to the new key, read back and compared by SHA-256, and only then is the record updated. Originals are
// never deleted. Safe to repeat. Private documents stay app-encrypted, byte for byte.
//
// Usage: node scripts/organize-media-folders.cjs [--dry-run] [--legacy-prefix safar-media] [--uploads <dir>]
//        (or npm run media:organize-folders -- --dry-run). Back up the database first.
'use strict';
const { resolve, join, basename, extname } = require('node:path');
const { existsSync, readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { mediaStorageKey, isFolderKey } = require('./media-folders.cjs');

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
const mask = (id) => String(id).slice(0, 8) + '…';
const PRIVATE = ['AADHAAR', 'DL', 'RC', 'INSURANCE', 'PUC'];

async function organizeMedia({ rows, storage, updateKey, uploadsDir, legacyPrefix, dryRun = false }) {
  const summary = { total: rows.length, moved: 0, alreadyInFolders: 0, missing: [], mismatched: [], dryRun };
  for (const row of rows) {
    if (isFolderKey(row.storageKey)) { summary.alreadyInFolders++; continue; }
    const key = String(row.storageKey);
    if (key.includes('..') || key.startsWith('/')) { summary.missing.push(mask(row.id)); continue; }
    const candidates = [() => storage.get(key), () => storage.getRaw(key)];
    if (legacyPrefix) candidates.push(() => storage.getRaw(`${legacyPrefix.replace(/\/+$/, '')}/${basename(key)}`));
    candidates.push(() => {
      const file = join(uploadsDir, basename(key));
      return Promise.resolve(existsSync(file) ? readFileSync(file) : null);
    });
    let bytes = null;
    for (const read of candidates) { bytes = await read(); if (bytes) break; }
    if (!bytes) { summary.missing.push(mask(row.id)); continue; }
    const extension = extname(key) === '.enc' ? '.enc' : '.jpg';
    const id = basename(key, extname(key));
    const target = mediaStorageKey(row.kind, row.ownerId, extension, id);
    if (dryRun) { summary.moved++; continue; }
    await storage.put(target, bytes, PRIVATE.includes(row.kind) || extension === '.enc' ? 'application/octet-stream' : 'image/jpeg');
    const check = await storage.get(target);
    if (!check || sha256(check) !== sha256(bytes)) { summary.mismatched.push(mask(row.id)); continue; }
    await updateKey(row.id, target);
    summary.moved++;
  }
  return summary;
}

async function main(argv = process.argv) {
  require('dotenv').config({ path: resolve(__dirname, '../.env'), quiet: true });
  const { PrismaClient } = require('@prisma/client');
  const url = /^postgres(ql)?:\/\//.test(process.env.POSTGRES_DATABASE_URL || '') ? process.env.POSTGRES_DATABASE_URL : process.env.DATABASE_URL || 'file:./portal.db';
  const adapter = /^postgres(ql)?:\/\//.test(url)
    ? new (require('@prisma/adapter-pg').PrismaPg)({ connectionString: url })
    : new (require('@prisma/adapter-better-sqlite3').PrismaBetterSqlite3)({ url });
  const prisma = new PrismaClient({ adapter });
  try {
    const { s3Storage } = require('./s3-storage.cjs');
    const storage = s3Storage();
    await storage.check();
    const arg = (name) => { const i = argv.indexOf(name); return i > 0 ? argv[i + 1] : undefined; };
    const rows = await prisma.media.findMany({ select: { id: true, kind: true, ownerId: true, storageKey: true }, orderBy: { createdAt: 'asc' } });
    const summary = await organizeMedia({
      rows,
      storage,
      updateKey: (id, storageKey) => prisma.media.update({ where: { id }, data: { storageKey } }),
      uploadsDir: resolve(arg('--uploads') || resolve(__dirname, '..', 'uploads')),
      legacyPrefix: arg('--legacy-prefix'),
      dryRun: argv.includes('--dry-run'),
    });
    console.log(JSON.stringify({ bucket: storage.bucket, prefix: storage.prefix, ...summary }, null, 2));
    if (summary.mismatched.length) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) main().catch((error) => { console.error(error.name === 'Error' ? error.message : `${error.name}: ${error.message}`); process.exit(1); });

module.exports = { organizeMedia };
