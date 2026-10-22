// Opens the local SQLite development database only. Refuses PostgreSQL, NODE_ENV=production and non-file URLs.
'use strict';
const { resolve } = require('node:path');
const { existsSync } = require('node:fs');
const { randomUUID } = require('node:crypto');

function openLocalDatabase(argv = process.argv) {
  require('dotenv').config({ path: resolve(__dirname, '../.env'), quiet: true });
  const i = argv.indexOf('--db');
  const url = process.env.DATABASE_URL || 'file:./portal.db';
  if (process.env.NODE_ENV === 'production' || /^postgres(ql)?:\/\//i.test(url)) throw new Error('Refusing: local SQLite development databases only.');
  if (i < 0 && !url.startsWith('file:')) throw new Error('Refusing: DATABASE_URL is not a SQLite file URL.');
  const file = resolve(i > 0 ? argv[i + 1] : resolve(__dirname, '..', url.slice('file:'.length)));
  if (!existsSync(file)) throw new Error('Database file not found: ' + file);
  const Database = require('better-sqlite3');
  return { db: new Database(file, { fileMustExist: true }), file };
}

// Matches Prisma's SQLite DateTime storage (ISO 8601 text with an explicit +00:00 offset).
const iso = (d = new Date()) => d.toISOString().replace('Z', '+00:00');
const now = () => iso();
const audit = (db, actorId, action, targetId, detail) =>
  db.prepare('INSERT INTO "AuditLog" ("id","actorId","action","targetId","detail","createdAt") VALUES (?,?,?,?,?,?)').run(randomUUID(), actorId, action, targetId, JSON.stringify(detail), now());

module.exports = { openLocalDatabase, audit, now, iso };
