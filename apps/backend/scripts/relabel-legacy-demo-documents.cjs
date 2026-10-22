// Remediation Option A (docs/VEHICLE_COMPLIANCE_REMEDIATION.md §6–7): relabel the 20 approved legacy documents that
// have no evidence file as unverified demo records (source DEMO_SEED). Nothing is deleted and no evidence is invented.
// Safety: aborts without changes unless each approved id prefix matches exactly one approved, evidence-less document.
// Each change writes one audit row with the previous values; repeated runs make no further changes or audit rows.
// The affected customer's verification is recomputed (demo records never count) and any affected approved vehicle
// is returned to PENDING_APPROVAL.
// Usage: node scripts/relabel-legacy-demo-documents.cjs [--db <file>]   (or npm run db:relabel-demo-documents)
'use strict';
const { openLocalDatabase, audit, now } = require('./local-sqlite.cjs');

// The exact 20 records from the Phase 5 record-level report (8-character id prefixes).
const APPROVED_PREFIXES = ['825f790f', 'aa4f472a', '0555c616', 'fae91c2a', 'e0ceccb6', '2b97de4f', '480b6266', 'aa2a1b55', 'c99720ad', '0790fea4',
  '5d485a79', '37fd328d', '18c005d9', 'de0ae878', 'ef27417d', '8a80137d', 'aa940713', 'c4b4538d', '83ea703b', '88665fa0'];
const NOTE = 'Demo seed data - unverified, no evidence file. Relabelled under remediation Option A; not a verified document.';
const UNVERIFIED = ['DIGILOCKER_TEST', 'DEMO_SEED'];
// Accounts created by scripts/seed.js; the 20 records belong only to these.
const SEED_OWNERS = ['host@safar.com', 'customer@safar.com'];

function relabelLegacyDemoDocuments(db, prefixes = APPROVED_PREFIXES) {
  const candidates = db.prepare(`SELECT * FROM "Document" WHERE "status" = 'APPROVED' AND "mediaId" IS NULL`).all();
  const matches = prefixes.map((prefix) => candidates.filter((d) => d.id.startsWith(prefix)));
  const problems = prefixes.filter((_, i) => matches[i].length !== 1);
  if (problems.length) throw new Error(`Aborted without changes: ${problems.length} approved prefix(es) do not match exactly one approved, evidence-less document (${problems.join(', ')}).`);
  const docs = matches.map((m) => m[0]);
  const owner = db.prepare(`SELECT "email" FROM "User" WHERE "id" = ?`);
  const reviewed = db.prepare(`SELECT 1 FROM "AuditLog" WHERE "targetId" = ? AND "action" <> 'DOCUMENT_RELABELLED_DEMO'`);
  const unexpected = docs.filter((d) => !SEED_OWNERS.includes(owner.get(d.userId)?.email) || reviewed.get(d.id));
  if (unexpected.length) throw new Error(`Aborted without changes: ${unexpected.length} matched document(s) are not unreviewed demo seed records.`);
  const summary = { relabelled: [], alreadyRelabelled: [], customers: [], vehiclesReturnedToPending: [] };
  db.transaction(() => {
    for (const doc of docs) {
      const done = db.prepare(`SELECT 1 FROM "AuditLog" WHERE "action" = 'DOCUMENT_RELABELLED_DEMO' AND "targetId" = ?`).get(doc.id);
      if (done && doc.source === 'DEMO_SEED') { summary.alreadyRelabelled.push(doc.id); continue; }
      db.prepare(`UPDATE "Document" SET "source" = 'DEMO_SEED', "reviewNote" = ?, "updatedAt" = ? WHERE "id" = ?`).run(NOTE, now(), doc.id);
      // Status stays APPROVED (Option A); the DEMO_SEED source is what excludes it from eligibility and verification.
      audit(db, 'SYSTEM', 'DOCUMENT_RELABELLED_DEMO', doc.id, { previousSource: doc.source, previousReviewNote: doc.reviewNote, status: doc.status, remediation: 'OPTION_A' });
      summary.relabelled.push(doc.id);
    }
    // Customers whose personal documents were relabelled: recompute verification without demo or test records.
    for (const userId of [...new Set(docs.filter((d) => !d.vehicleId).map((d) => d.userId))]) {
      const user = db.prepare(`SELECT "isVerified", "dlValidUntil" FROM "User" WHERE "id" = ?`).get(userId);
      const approved = db.prepare(`SELECT "kind", "validUntil" FROM "Document" WHERE "userId" = ? AND "vehicleId" IS NULL AND "status" = 'APPROVED' AND "source" NOT IN (${UNVERIFIED.map(() => '?').join(',')})`).all(userId, ...UNVERIFIED);
      const dl = approved.filter((d) => d.kind === 'DL' && d.validUntil && Date.parse(d.validUntil) > Date.now()).sort((a, b) => Date.parse(b.validUntil) - Date.parse(a.validUntil))[0];
      const isVerified = Boolean(dl && approved.some((d) => d.kind === 'AADHAAR')) ? 1 : 0;
      const dlValidUntil = dl ? dl.validUntil : null;
      if (Number(user.isVerified) === isVerified && (user.dlValidUntil ?? null) === dlValidUntil) continue;
      db.prepare(`UPDATE "User" SET "isVerified" = ?, "dlValidUntil" = ? WHERE "id" = ?`).run(isVerified, dlValidUntil, userId);
      audit(db, 'SYSTEM', 'USER_VERIFICATION_RECOMPUTED', userId, { previous: { isVerified: Boolean(user.isVerified), dlValidUntil: user.dlValidUntil }, isVerified: Boolean(isVerified), dlValidUntil, reason: 'DEMO_DOCUMENTS_UNVERIFIED' });
      summary.customers.push(userId);
    }
    // Vehicles backed by these documents must not be approved on their strength.
    for (const vehicleId of [...new Set(docs.filter((d) => d.vehicleId).map((d) => d.vehicleId))]) {
      const v = db.prepare(`SELECT "approvalStatus", "availability", "availabilityReason" FROM "Vehicle" WHERE "id" = ?`).get(vehicleId);
      if (v.approvalStatus !== 'APPROVED') continue;
      db.prepare(`UPDATE "Vehicle" SET "approvalStatus" = 'PENDING_APPROVAL', "status" = 'PENDING_APPROVAL' WHERE "id" = ?`).run(vehicleId);
      audit(db, 'SYSTEM', 'VEHICLE_APPROVAL_REVOKED', vehicleId, { reason: 'DEMO_DOCUMENTS_UNVERIFIED', remediation: 'OPTION_A' });
      summary.vehiclesReturnedToPending.push(vehicleId);
    }
  })();
  return summary;
}

module.exports = { relabelLegacyDemoDocuments, APPROVED_PREFIXES };

if (require.main === module) {
  const { db, file } = openLocalDatabase();
  const s = relabelLegacyDemoDocuments(db);
  db.close();
  const mask = (ids) => ids.map((id) => id.slice(0, 8) + '…');
  console.log(JSON.stringify({ database: file, relabelled: mask(s.relabelled), alreadyRelabelled: s.alreadyRelabelled.length, customersRecomputed: s.customers.length, vehiclesReturnedToPending: s.vehiclesReturnedToPending.length }, null, 2));
}
