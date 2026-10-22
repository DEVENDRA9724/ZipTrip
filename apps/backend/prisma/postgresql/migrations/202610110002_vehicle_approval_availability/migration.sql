-- Phase 6: separate vehicle approval from availability (docs/VEHICLE_APPROVAL_AVAILABILITY_PLAN.md).
-- Additive: the legacy "status" column is kept and re-derived. No rows are deleted and no booking is touched.

ALTER TABLE "Vehicle"
  ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "availability" TEXT NOT NULL DEFAULT 'INACTIVE',
  ADD COLUMN IF NOT EXISTS "availabilityReason" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedById" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectedReason" TEXT;

CREATE INDEX IF NOT EXISTS "Vehicle_approvalStatus_availability_idx" ON "Vehicle"("approvalStatus", "availability");

-- Conservative backfill. Approval is granted only with review evidence: a VEHICLE_ACTIVE decision by an administrator
-- other than the host. ACTIVE cars additionally need RC, Insurance and PUC approved with an evidence file from a genuine
-- source. Every backfilled car gets one VEHICLE_STATUS_BACKFILLED audit row holding its previous status (reversible);
-- cars that already have that row are skipped, so the backfill never runs twice for the same car.
WITH review AS (
  SELECT v."id", v."status"::text AS "previousStatus",
    (SELECT a."actorId" FROM "AuditLog" a JOIN "User" u ON u."id" = a."actorId" AND u."role" = 'ADMIN'
      WHERE a."targetId" = v."id" AND a."action" = 'VEHICLE_ACTIVE' AND a."actorId" <> v."hostId"
      ORDER BY a."createdAt" DESC LIMIT 1) AS "approverId",
    (SELECT a."createdAt" FROM "AuditLog" a JOIN "User" u ON u."id" = a."actorId" AND u."role" = 'ADMIN'
      WHERE a."targetId" = v."id" AND a."action" = 'VEHICLE_ACTIVE' AND a."actorId" <> v."hostId"
      ORDER BY a."createdAt" DESC LIMIT 1) AS "approvedAt",
    (SELECT COUNT(DISTINCT d."kind") FROM "Document" d
      WHERE d."vehicleId" = v."id" AND d."kind" IN ('RC', 'INSURANCE', 'PUC') AND d."status" = 'APPROVED'
        AND d."mediaId" IS NOT NULL AND d."source" NOT IN ('DIGILOCKER_TEST', 'DEMO_SEED')) = 3 AS "evidenced"
  FROM "Vehicle" v
  WHERE NOT EXISTS (SELECT 1 FROM "AuditLog" b WHERE b."targetId" = v."id" AND b."action" = 'VEHICLE_STATUS_BACKFILLED')
), decided AS (
  SELECT "id", "previousStatus", "approverId", "approvedAt",
    CASE
      WHEN "previousStatus" = 'ACTIVE' AND "approverId" IS NOT NULL AND "evidenced" THEN 'APPROVED'
      WHEN "previousStatus" IN ('INACTIVE', 'MAINTENANCE') AND "approverId" IS NOT NULL THEN 'APPROVED'
      ELSE 'PENDING_APPROVAL'
    END AS "approvalStatus",
    CASE WHEN "previousStatus" = 'ACTIVE' AND "approverId" IS NOT NULL AND "evidenced" THEN 'ACTIVE' ELSE 'INACTIVE' END AS "availability",
    CASE
      WHEN "previousStatus" = 'ACTIVE' AND ("approverId" IS NULL OR NOT "evidenced") THEN 'REVIEW_REQUIRED'
      WHEN "previousStatus" = 'MAINTENANCE' THEN 'MAINTENANCE'
      WHEN "previousStatus" = 'INACTIVE' AND "approverId" IS NOT NULL THEN 'ADMIN_SUSPENDED'
      ELSE NULL
    END AS "availabilityReason"
  FROM review
)
INSERT INTO "AuditLog" ("id", "actorId", "action", "targetId", "detail", "createdAt")
SELECT gen_random_uuid()::text, 'SYSTEM', 'VEHICLE_STATUS_BACKFILLED', "id",
  json_build_object('previousStatus', "previousStatus", 'approvalStatus', "approvalStatus", 'availability', "availability",
    'availabilityReason', "availabilityReason",
    'approvedById', CASE WHEN "approvalStatus" = 'APPROVED' THEN "approverId" END,
    'approvedAt', CASE WHEN "approvalStatus" = 'APPROVED' THEN "approvedAt" END, 'migration', '202610110002')::text,
  CURRENT_TIMESTAMP
FROM decided;

-- Apply the decisions recorded above (only to cars still carrying the column defaults).
UPDATE "Vehicle" v SET
  "approvalStatus" = (a."detail"::json ->> 'approvalStatus'),
  "availability" = (a."detail"::json ->> 'availability'),
  "availabilityReason" = (a."detail"::json ->> 'availabilityReason'),
  "approvedById" = (a."detail"::json ->> 'approvedById'),
  "approvedAt" = (a."detail"::json ->> 'approvedAt')::timestamp(3)
FROM "AuditLog" a
WHERE a."targetId" = v."id" AND a."action" = 'VEHICLE_STATUS_BACKFILLED' AND (a."detail"::json ->> 'migration') = '202610110002'
  AND v."approvalStatus" = 'DRAFT' AND v."approvedAt" IS NULL;

-- Keep the legacy single-field status consistent with the new fields.
UPDATE "Vehicle" SET "status" = (CASE
  WHEN "approvalStatus" = 'APPROVED' AND "availability" = 'ACTIVE' THEN 'ACTIVE'
  WHEN "approvalStatus" = 'APPROVED' AND "availabilityReason" = 'MAINTENANCE' THEN 'MAINTENANCE'
  WHEN "approvalStatus" IN ('APPROVED', 'REJECTED') THEN 'INACTIVE'
  ELSE 'PENDING_APPROVAL' END)::"VehicleStatus";
