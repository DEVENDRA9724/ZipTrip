ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "agreementVersion" TEXT NOT NULL DEFAULT 'safarcars-car-sharing-v2';

ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "agreementSnapshot" TEXT;
