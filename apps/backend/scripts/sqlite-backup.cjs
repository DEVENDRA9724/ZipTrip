// Local SQLite backup with verification. Refuses anything that is not a local SQLite file (never PostgreSQL/production).
// Uses SQLite's online backup API (consistent even while a server has the database open), then checks the copy with
// PRAGMA integrity_check and compares every table's row count with the source.
// Usage: node scripts/sqlite-backup.cjs [--db <path>] [--out <dir>]   (or npm run db:backup)
// Restore: stop the API, keep a copy of the current file, then copy the backup over the database file (see
// docs/LOCAL_DATABASE_RECOVERY.md).
'use strict';
const { createHash } = require('node:crypto');
const { existsSync, mkdirSync, readFileSync } = require('node:fs');
const { resolve, join } = require('node:path');
require('dotenv').config({ path: resolve(__dirname, '../.env'), quiet: true });
const Database = require('better-sqlite3');

const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const url = process.env.DATABASE_URL || 'file:./portal.db';
if (process.env.NODE_ENV === 'production' || /^postgres(ql)?:\/\//i.test(url)) throw new Error('Refusing: this script only backs up a local SQLite development database.');
if (!url.startsWith('file:')) throw new Error('Refusing: DATABASE_URL is not a SQLite file URL.');
const source = resolve(arg('--db') || resolve(__dirname, '..', url.slice('file:'.length)));
if (!existsSync(source)) throw new Error('Database file not found: ' + source);
const outDir = resolve(arg('--out') || resolve(__dirname, '../backups'));
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const target = join(outDir, `portal-${stamp}.db`);

const counts = (db) => Object.fromEntries(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({ name }) => [name, db.prepare(`SELECT COUNT(*) AS c FROM "${name}"`).get().c]));

(async () => {
  const live = new Database(source, { readonly: true, fileMustExist: true });
  const before = counts(live);
  await live.backup(target);
  live.close();
  const copy = new Database(target, { readonly: true, fileMustExist: true });
  const integrity = copy.pragma('integrity_check', { simple: true });
  const after = counts(copy);
  copy.close();
  if (integrity !== 'ok') throw new Error('Backup integrity_check failed: ' + integrity);
  if (JSON.stringify(after) !== JSON.stringify(before)) throw new Error('Backup row counts differ from the source');
  const sha = createHash('sha256').update(readFileSync(target)).digest('hex');
  console.log(JSON.stringify({ source, backup: target, sha256: sha, integrity, tables: Object.keys(after).length, rows: after }, null, 2));
})().catch((error) => { console.error(error.message); process.exit(1); });
