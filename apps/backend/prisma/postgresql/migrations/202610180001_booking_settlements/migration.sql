CREATE TABLE IF NOT EXISTS "BookingSettlement" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "depositHeld" DECIMAL(65,30) NOT NULL,
  "automaticCharges" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "damageCharges" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "fuelCharges" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "tollCharges" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "fineCharges" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "cleaningCharges" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "otherCharges" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "totalDeduction" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "refundAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "additionalAmountDue" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "note" TEXT,
  "reviewedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingSettlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BookingSettlement_bookingId_key"
  ON "BookingSettlement"("bookingId");
CREATE INDEX IF NOT EXISTS "BookingSettlement_status_createdAt_idx"
  ON "BookingSettlement"("status", "createdAt");

DO $$ BEGIN
  ALTER TABLE "BookingSettlement" ADD CONSTRAINT "BookingSettlement_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
