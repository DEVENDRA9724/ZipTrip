// Uploads files copied from another environment (a folder mirroring the bucket layout below S3_PREFIX, for example
// <dir>/vehicles/<owner>/FRONT/<id>.jpg) to S3 for the media records that point at them.
// Private documents are app-encrypted with the source environment's key: they are decrypted with
// OLD_DOCUMENT_ENCRYPTION_KEY (read from standard input, never from arguments or files) and re-encrypted with this
// server's DOCUMENT_ENCRYPTION_KEY; the record's checksum and size are updated. Every object is read back and compared.
// Safe to repeat: objects already in S3 with the expected bytes are skipped.
// Usage: printf '%s' "$OLD_KEY" | node scripts/upload-staged-media.cjs <dir> [--dry-run]
'use strict';
const { resolve, join } = require('node:path');
const { existsSync, readFileSync } = require('node:fs');
const { createHash, createCipheriv, createDecipheriv, randomBytes } = require('node:crypto');

const PRIVATE = ['AADHAAR', 'DL', 'RC', 'INSURANCE', 'PUC'];
const sha256 = (b) => createHash('sha256').update(b).digest('hex');
const mask = (id) => String(id).slice(0, 8) + '…';
const keyFrom = (hex, name) => { if (!/^[a-f0-9]{64}$/i.test(hex || '')) throw new Error(`${name} must be 64 hexadecimal characters`); return Buffer.from(hex, 'hex'); };

function reencrypt(stored, oldKey, newKey) {
  const decipher = createDecipheriv('aes-256-gcm', oldKey, stored.subarray(0, 12));
  decipher.setAuthTag(stored.subarray(12, 28));
  const plain = Buffer.concat([decipher.update(stored.subarray(28)), decipher.final()]);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', newKey, iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
}

async function uploadStaged({ rows, dir, storage, oldKey, newKey, updateMedia, dryRun }) {
  const summary = { total: rows.length, uploaded: 0, reencrypted: 0, alreadyInS3: 0, missingFile: [], failed: [], dryRun };
  for (const row of rows) {
    const file = join(dir, row.storageKey);
    if (row.storageKey.includes('..') || !existsSync(file)) { summary.missingFile.push(mask(row.id)); continue; }
    let bytes = readFileSync(file);
    const isPrivate = PRIVATE.includes(row.kind) || row.storageKey.endsWith('.enc');
    if (isPrivate) {
      const existing = await storage.get(row.storageKey);
      if (existing && sha256(existing) === row.sha256) { summary.alreadyInS3++; continue; }
      bytes = reencrypt(bytes, oldKey, newKey);
      summary.reencrypted++;
    } else {
      const existing = await storage.get(row.storageKey);
      if (existing && sha256(existing) === sha256(bytes)) { summary.alreadyInS3++; continue; }
    }
    if (dryRun) { summary.uploaded++; continue; }
    await storage.put(row.storageKey, bytes, isPrivate ? 'application/octet-stream' : 'image/jpeg');
    const check = await storage.get(row.storageKey);
    if (!check || sha256(check) !== sha256(bytes)) { summary.failed.push(mask(row.id)); continue; }
    if (isPrivate) await updateMedia(row.id, { sha256: sha256(bytes), size: bytes.length });
    summary.uploaded++;
  }
  return summary;
}

async function main(argv = process.argv) {
  require('dotenv').config({ path: resolve(__dirname, '../.env'), quiet: true });
  const dir = argv[2] && resolve(argv[2]);
  if (!dir || !existsSync(dir)) throw new Error('Usage: printf "%s" "$OLD_KEY" | node scripts/upload-staged-media.cjs <dir> [--dry-run]');
  const oldKey = keyFrom(readFileSync(0, 'utf8').trim(), 'The old key on standard input');
  const newKey = keyFrom(process.env.DOCUMENT_ENCRYPTION_KEY, 'DOCUMENT_ENCRYPTION_KEY');
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ adapter: new (require('@prisma/adapter-pg').PrismaPg)({ connectionString: process.env.DATABASE_URL }) });
  try {
    const { s3Storage } = require('./s3-storage.cjs');
    const storage = s3Storage();
    await storage.check();
    const rows = await prisma.media.findMany({ select: { id: true, kind: true, storageKey: true, sha256: true } });
    const summary = await uploadStaged({ rows, dir, storage, oldKey, newKey, dryRun: argv.includes('--dry-run'),
      updateMedia: (id, data) => prisma.media.update({ where: { id }, data }) });
    console.log(JSON.stringify({ bucket: storage.bucket, prefix: storage.prefix, ...summary }, null, 2));
    if (summary.failed.length) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) main().catch((error) => { console.error(error.name === 'Error' ? error.message : `${error.name}: ${error.message}`); process.exit(1); });

module.exports = { uploadStaged, reencrypt };
