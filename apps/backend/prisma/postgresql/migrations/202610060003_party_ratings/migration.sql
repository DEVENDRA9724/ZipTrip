CREATE TABLE IF NOT EXISTS "PartyRating" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "targetRole" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartyRating_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PartyRating_bookingId_authorId_targetId_key"
  ON "PartyRating"("bookingId", "authorId", "targetId");
CREATE INDEX IF NOT EXISTS "PartyRating_targetId_createdAt_idx"
  ON "PartyRating"("targetId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "PartyRating" ADD CONSTRAINT "PartyRating_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PartyRating" ADD CONSTRAINT "PartyRating_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PartyRating" ADD CONSTRAINT "PartyRating_targetId_fkey"
    FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
