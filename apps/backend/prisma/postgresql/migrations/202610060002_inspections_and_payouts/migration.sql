ALTER TABLE "Inspection"
  ADD COLUMN IF NOT EXISTS "mediaIds" TEXT;

CREATE TABLE IF NOT EXISTS "PayoutAccount" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accountHolderName" TEXT NOT NULL,
  "bankName" TEXT NOT NULL,
  "accountNumberLast4" TEXT NOT NULL,
  "ifscCode" TEXT NOT NULL,
  "encryptedAccountNumber" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayoutAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Payout" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "amount" DECIMAL NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reference" TEXT,
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PayoutAccount_userId_key" ON "PayoutAccount"("userId");
CREATE INDEX IF NOT EXISTS "Payout_accountId_status_idx" ON "Payout"("accountId", "status");
DO $$ BEGIN
  ALTER TABLE "PayoutAccount" ADD CONSTRAINT "PayoutAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Payout" ADD CONSTRAINT "Payout_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PayoutAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
