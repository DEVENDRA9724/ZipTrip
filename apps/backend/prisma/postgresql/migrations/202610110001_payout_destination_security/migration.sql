-- Phase 4B: bank-change re-verification with a second approver, and immutable payout destination snapshots.
-- Additive only: no column is dropped or rewritten, and no payout id, amount, status, reference or timestamp changes.

-- Payout accounts: destination revision, change initiator and the reviewer/revision that verified it.
ALTER TABLE "PayoutAccount"
  ADD COLUMN IF NOT EXISTS "revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "fingerprint" TEXT,
  ADD COLUMN IF NOT EXISTS "changedById" TEXT,
  ADD COLUMN IF NOT EXISTS "changedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewedById" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "verifiedRevision" INTEGER;

-- Existing accounts were last changed by their owner. Their earlier verification was not bound to a revision or a
-- second approver, so verifiedRevision stays NULL: they must be re-verified before new payouts can be created or
-- processed. The historical status value is kept unchanged.
UPDATE "PayoutAccount" SET "changedById" = "userId", "changedAt" = "updatedAt" WHERE "changedById" IS NULL;

-- Payouts: destination snapshot captured at creation. The safe default is RECONCILIATION_REQUIRED, so a row
-- without a snapshot can never be processed or marked paid.
ALTER TABLE "Payout"
  ADD COLUMN IF NOT EXISTS "destinationState" TEXT NOT NULL DEFAULT 'RECONCILIATION_REQUIRED',
  ADD COLUMN IF NOT EXISTS "destinationAccountHolderName" TEXT,
  ADD COLUMN IF NOT EXISTS "destinationBankName" TEXT,
  ADD COLUMN IF NOT EXISTS "destinationIfscCode" TEXT,
  ADD COLUMN IF NOT EXISTS "destinationAccountNumberLast4" TEXT,
  ADD COLUMN IF NOT EXISTS "destinationEncryptedAccountNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "destinationFingerprint" TEXT,
  ADD COLUMN IF NOT EXISTS "destinationAccountRevision" INTEGER,
  ADD COLUMN IF NOT EXISTS "destinationCapturedAt" TIMESTAMP(3);

-- Legacy payouts: the account row was overwritten in place, so its current contents do not prove where an older
-- payout was meant to go. Nothing is copied from it. Final payouts are marked LEGACY_UNVERIFIED (informational);
-- open ones (PENDING / PROCESSING / FAILED) need an explicit reconciliation decision.
UPDATE "Payout"
SET "destinationState" = CASE WHEN "status" IN ('PAID', 'CANCELLED') THEN 'LEGACY_UNVERIFIED' ELSE 'RECONCILIATION_REQUIRED' END
WHERE "destinationCapturedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "Payout_destinationState_idx" ON "Payout"("destinationState");
