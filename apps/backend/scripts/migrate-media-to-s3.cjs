// Copies every uploaded file from the old local folder (apps/backend/uploads) to S3, so the portal can serve all
// photos and documents from S3 only. Each object is read back and compared by SHA-256 before it counts as migrated.
// Safe to repeat: objects already in S3 with identical bytes are skipped. Local files are never deleted or changed,
// and the database is only read. Private documents stay app-encrypted exactly as they were on disk.
// Usage: node scripts/migrate-media-to-s3.cjs [--db <file>] [--uploads <dir>] [--verify-only]
//        (or npm run media:migrate-to-s3). Take a database backup first: npm run db:backup.
'use strict';
const { resolve, join } = require('node:path');
const { existsSync, readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { openLocalDatabase } = require('./local-sqlite.cjs');
const { s3Storage } = require('./s3-storage.cjs');

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
// Only the first characters of ids are reported.
const mask = (id) => String(id).slice(0, 8) + '…';
// Stored names are generated UUIDs, optionally under one folder ("safar-media/<id>.jpg" from the earlier storage code);
// anything else (deeper paths, "..") is refused rather than read.
const SAFE_KEY = /^([A-Za-z0-9][A-Za-z0-9._-]*\/)?[A-Za-z0-9][A-Za-z0-9._-]*$/;

async function migrateMediaToS3({ db, storage, uploadsDir, verifyOnly = false }) {
  const rows = db.prepare('SELECT "id", "storageKey", "mimeType", "kind" FROM "Media" ORDER BY "createdAt"').all();
  const summary = { total: rows.length, copied: 0, alreadyInS3: 0, verified: 0, missingLocally: [], mismatched: [], unsafeKeys: [] };
  for (const row of rows) {
    if (!SAFE_KEY.test(row.storageKey) || row.storageKey.includes('..')) { summary.unsafeKeys.push(mask(row.id)); continue; }
    const file = join(uploadsDir, row.storageKey);
    const local = existsSync(file) ? readFileSync(file) : null;
    const existing = await storage.get(row.storageKey);
    if (!local) {
      // Already in S3 (for example uploaded after the switch) counts as fine; otherwise the file is lost.
      if (existing) { summary.alreadyInS3++; summary.verified++; } else summary.missingLocally.push(mask(row.id));
      continue;
    }
    if (existing && sha256(existing) === sha256(local)) { summary.alreadyInS3++; summary.verified++; continue; }
    if (verifyOnly) { summary.mismatched.push(mask(row.id)); continue; }
    // Private documents are already encrypted on disk, so they are stored as opaque bytes.
    await storage.put(row.storageKey, local, row.mimeType === 'image/jpeg' && !['RC', 'INSURANCE', 'PUC', 'DL', 'AADHAAR'].includes(row.kind) ? 'image/jpeg' : 'application/octet-stream');
    const check = await storage.get(row.storageKey);
    if (check && sha256(check) === sha256(local)) { summary.copied++; summary.verified++; } else summary.mismatched.push(mask(row.id));
  }
  return summary;
}

async function main(argv = process.argv) {
  const { db, file } = openLocalDatabase(argv);
  try {
    const u = argv.indexOf('--uploads');
    const uploadsDir = resolve(u > 0 ? argv[u + 1] : resolve(__dirname, '..', 'uploads'));
    const storage = s3Storage();
    await storage.check();
    const summary = await migrateMediaToS3({ db, storage, uploadsDir, verifyOnly: argv.includes('--verify-only') });
    console.log(JSON.stringify({ database: file.split(/[\\/]/).pop(), bucket: storage.bucket, prefix: storage.prefix, ...summary }, null, 2));
    if (summary.mismatched.length || summary.unsafeKeys.length) process.exitCode = 1;
    if (summary.missingLocally.length) console.warn(`${summary.missingLocally.length} media record(s) have no local file and no S3 object; those images were already missing before the migration.`);
  } finally {
    db.close();
  }
}

if (require.main === module) main().catch((error) => { console.error(error.name === 'Error' ? error.message : `${error.name}: ${error.message}`); process.exit(1); });

module.exports = { migrateMediaToS3 };
