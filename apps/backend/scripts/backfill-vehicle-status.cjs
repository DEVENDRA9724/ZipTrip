// SQLite counterpart of the PostgreSQL migration 202610110002_vehicle_approval_availability backfill. `prisma db push`
// adds the columns with their defaults; this applies the same conservative decisions and audit rows. Idempotent: a car
// with a VEHICLE_STATUS_BACKFILLED audit row, or created by the new code, is never touched again.
// Usage: node scripts/backfill-vehicle-status.cjs [--db <file>]   (or npm run db:backfill-vehicles)
'use strict';
const { openLocalDatabase, audit } = require('./local-sqlite.cjs');

function legacyStatus(approval, availability, reason) {
  if (approval === 'APPROVED') return availability === 'ACTIVE' ? 'ACTIVE' : reason === 'MAINTENANCE' ? 'MAINTENANCE' : 'INACTIVE';
  return approval === 'REJECTED' ? 'INACTIVE' : 'PENDING_APPROVAL';
}

function backfillVehicleStatus(db) {
  const candidates = db.prepare(`SELECT v."id", v."status", v."hostId" FROM "Vehicle" v
    WHERE v."approvalStatus" = 'DRAFT' AND v."approvedAt" IS NULL
      AND NOT EXISTS (SELECT 1 FROM "AuditLog" b WHERE b."targetId" = v."id" AND b."action" = 'VEHICLE_STATUS_BACKFILLED')
      AND NOT EXISTS (SELECT 1 FROM "AuditLog" c WHERE c."targetId" = v."id" AND c."action" = 'VEHICLE_CREATED_BY_ADMIN' AND c."detail" LIKE '%"approvalStatus"%')`).all();
  const approval = db.prepare(`SELECT a."actorId", a."createdAt" FROM "AuditLog" a JOIN "User" u ON u."id" = a."actorId" AND u."role" = 'ADMIN'
    WHERE a."targetId" = ? AND a."action" = 'VEHICLE_ACTIVE' AND a."actorId" <> ? ORDER BY a."createdAt" DESC LIMIT 1`);
  const evidenced = db.prepare(`SELECT COUNT(DISTINCT d."kind") AS c FROM "Document" d WHERE d."vehicleId" = ? AND d."kind" IN ('RC','INSURANCE','PUC')
    AND d."status" = 'APPROVED' AND d."mediaId" IS NOT NULL AND d."source" NOT IN ('DIGILOCKER_TEST','DEMO_SEED')`);
  const update = db.prepare(`UPDATE "Vehicle" SET "approvalStatus" = ?, "availability" = ?, "availabilityReason" = ?, "approvedById" = ?, "approvedAt" = ?, "status" = ?
    WHERE "id" = ? AND "approvalStatus" = 'DRAFT' AND "approvedAt" IS NULL`);
  const results = [];
  db.transaction(() => {
    for (const v of candidates) {
      const reviewed = approval.get(v.id, v.hostId);
      const hasEvidence = evidenced.get(v.id).c === 3;
      const approved = (v.status === 'ACTIVE' && reviewed && hasEvidence) || (['INACTIVE', 'MAINTENANCE'].includes(v.status) && reviewed);
      const approvalStatus = approved ? 'APPROVED' : 'PENDING_APPROVAL';
      const availability = v.status === 'ACTIVE' && approved ? 'ACTIVE' : 'INACTIVE';
      const availabilityReason = v.status === 'ACTIVE' && !approved ? 'REVIEW_REQUIRED' : v.status === 'MAINTENANCE' ? 'MAINTENANCE' : v.status === 'INACTIVE' && reviewed ? 'ADMIN_SUSPENDED' : null;
      const decision = { previousStatus: v.status, approvalStatus, availability, availabilityReason, approvedById: approved ? reviewed.actorId : null, approvedAt: approved ? reviewed.createdAt : null, migration: '202610110002' };
      audit(db, 'SYSTEM', 'VEHICLE_STATUS_BACKFILLED', v.id, decision);
      update.run(approvalStatus, availability, availabilityReason, decision.approvedById, decision.approvedAt, legacyStatus(approvalStatus, availability, availabilityReason), v.id);
      results.push({ id: v.id, ...decision });
    }
  })();
  return results;
}

module.exports = { backfillVehicleStatus };

if (require.main === module) {
  const { db, file } = openLocalDatabase();
  const results = backfillVehicleStatus(db);
  db.close();
  console.log(JSON.stringify({ database: file, backfilled: results.length, vehicles: results.map((r) => ({ id: r.id.slice(0, 8) + '…', previousStatus: r.previousStatus, approvalStatus: r.approvalStatus, availability: r.availability, availabilityReason: r.availabilityReason })) }, null, 2));
}
