// Local demo mode only: gives an account labelled demo identity records (DL + Aadhaar, source DEMO_SEED) and recomputes its
// verification, so the portal can be shown end to end without real documents. Requires DEMO_VERIFICATION=true in
// apps/backend/.env and a local SQLite database; refuses production and PostgreSQL. Records are never labelled genuine,
// and they stop counting as soon as DEMO_VERIFICATION is removed. Each change writes an audit row with previous values.
// Repeated runs make no further changes. Cars are approved separately through the admin API, which applies the normal checks.
// Usage: node scripts/demo-complete-account.cjs <email> [--db <file>]   (or npm run demo:complete-account -- <email>)
'use strict';
const { randomUUID } = require('node:crypto');
const { openLocalDatabase, audit, now, iso } = require('./local-sqlite.cjs');

const NOTE = 'Demo seed data - local demo mode only (DEMO_VERIFICATION). Not a verified document.';
const SYSTEM_ACTOR = 'system:demo-complete-account';

function completeDemoAccount(db, email, at = new Date()) {
  const user = db.prepare('SELECT "id", "isVerified", "dlValidUntil" FROM "User" WHERE "email" = ?').get(email);
  if (!user) throw new Error('No account with that email in the local database.');
  const summary = { created: [], verified: false, changed: false };
  const insert = db.prepare(`INSERT INTO "Document" ("id","userId","vehicleId","kind","status","source","reviewNote","validUntil","createdAt","updatedAt")
    VALUES (?,?,NULL,?,'APPROVED','DEMO_SEED',?,?,?,?)`);
  db.transaction(() => {
    for (const kind of ['DL', 'AADHAAR']) {
      const existing = db.prepare(`SELECT 1 FROM "Document" WHERE "userId" = ? AND "vehicleId" IS NULL AND "kind" = ? AND "status" = 'APPROVED'
        AND "source" <> 'DIGILOCKER_TEST' AND ("validUntil" IS NULL OR "validUntil" > ?)`).get(user.id, kind, iso(at));
      if (existing) continue;
      const id = randomUUID();
      const validUntil = kind === 'DL' ? iso(new Date(at.getTime() + 2 * 365 * 86400000)) : null;
      insert.run(id, user.id, kind, NOTE, validUntil, now(), now());
      audit(db, SYSTEM_ACTOR, 'DOCUMENT_DEMO_CREATED', id, { kind, source: 'DEMO_SEED', validUntil, reason: 'Local demo mode' });
      summary.created.push(kind);
    }
    // Same rule as recomputeCustomerVerification with demo mode on: approved, unexpired DL plus approved Aadhaar,
    // provider test data excluded.
    const approved = db.prepare(`SELECT "kind", "validUntil" FROM "Document" WHERE "userId" = ? AND "vehicleId" IS NULL AND "status" = 'APPROVED'
      AND "source" <> 'DIGILOCKER_TEST'`).all(user.id);
    const dl = approved.filter((d) => d.kind === 'DL' && d.validUntil && new Date(d.validUntil) > at).sort((a, b) => new Date(b.validUntil) - new Date(a.validUntil))[0];
    const isVerified = Boolean(dl && approved.some((d) => d.kind === 'AADHAAR'));
    const dlValidUntil = dl ? dl.validUntil : null;
    summary.verified = isVerified;
    if (Boolean(user.isVerified) !== isVerified || user.dlValidUntil !== dlValidUntil) {
      db.prepare('UPDATE "User" SET "isVerified" = ?, "dlValidUntil" = ?, "updatedAt" = ? WHERE "id" = ?').run(isVerified ? 1 : 0, dlValidUntil, now(), user.id);
      audit(db, SYSTEM_ACTOR, 'USER_VERIFICATION_RECOMPUTED', user.id, {
        previous: { isVerified: Boolean(user.isVerified), dlValidUntil: user.dlValidUntil }, isVerified, dlValidUntil, reason: 'Local demo mode records',
      });
      summary.changed = true;
    }
  })();
  return summary;
}

if (require.main === module) {
  try {
    const { db } = openLocalDatabase();
    try {
      if (process.env.DEMO_VERIFICATION !== 'true') throw new Error('Set DEMO_VERIFICATION=true in apps/backend/.env first (local demo mode).');
      const email = process.argv.slice(2).find((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--db');
      if (!email) throw new Error('Usage: node scripts/demo-complete-account.cjs <email>');
      console.log(JSON.stringify(completeDemoAccount(db, email)));
    } finally {
      db.close();
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { completeDemoAccount };
