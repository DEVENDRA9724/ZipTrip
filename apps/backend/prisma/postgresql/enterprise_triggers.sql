-- ============================================================================
-- SAFAR ENTERPRISE POSTGRESQL: OVERLAP PREVENTION TRIGGER & NORMALIZED VIEWS
-- ============================================================================

-- 1. Enable btree_gist extension for range indexing if available
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. Trigger Function: Prevent Overlapping Vehicle Reservations & Maintenance Blocks
CREATE OR REPLACE FUNCTION prevent_vehicle_double_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    conflicting_booking_ref TEXT;
    conflicting_block_reason TEXT;
BEGIN
    -- Ignore cancelled Bookings
    IF NEW.status = 'CANCELLED' THEN
        RETURN NEW;
    END IF;

    -- Validate chronological window
    IF NEW."endDate" <= NEW."startDate" THEN
        RAISE EXCEPTION 'Invalid reservation window: scheduled_end (%) must be strictly after scheduled_start (%)',
            NEW."endDate", NEW."startDate"
            USING ERRCODE = '22023';
    END IF;

    -- Acquire row-level lock on the target Vehicle to serialize concurrent booking attempts
    PERFORM 1 FROM "Vehicle" WHERE id = NEW."vehicleId" FOR UPDATE;

    -- Check for any overlapping active/confirmed/unexpired-pending booking on the same vehicle
    SELECT "bookingRef"
      INTO conflicting_booking_ref
      FROM "Booking"
     WHERE "vehicleId" = NEW."vehicleId"
       AND id <> COALESCE(NEW.id, '')
       AND (
            status IN ('CONFIRMED', 'ACTIVE')
            OR (status = 'PENDING' AND ("expiresAt" IS NULL OR "expiresAt" > CURRENT_TIMESTAMP))
       )
       AND tstzrange("startDate", "endDate", '[)') && tstzrange(NEW."startDate", NEW."endDate", '[)')
     LIMIT 1;

    IF conflicting_booking_ref IS NOT NULL THEN
        RAISE EXCEPTION 'Double-booking prevented: Vehicle % is already reserved by booking % during the requested window (% to %)',
            NEW."vehicleId", conflicting_booking_ref, NEW."startDate", NEW."endDate"
            USING ERRCODE = 'P0001';
    END IF;

    -- Check for any overlapping unreleased maintenance / host availability blocks
    SELECT reason
      INTO conflicting_block_reason
      FROM "AvailabilityBlock"
     WHERE "vehicleId" = NEW."vehicleId"
       AND "releasedAt" IS NULL
       AND tstzrange("startDate", "endDate", '[)') && tstzrange(NEW."startDate", NEW."endDate", '[)')
     LIMIT 1;

    IF conflicting_block_reason IS NOT NULL THEN
        RAISE EXCEPTION 'Vehicle unavailable: Blocked for "%" during the requested window',
            conflicting_block_reason
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_vehicle_double_booking ON "Booking";
CREATE TRIGGER trg_prevent_vehicle_double_booking
BEFORE INSERT OR UPDATE OF "vehicleId", "startDate", "endDate", status
ON "Booking"
FOR EACH ROW
EXECUTE FUNCTION prevent_vehicle_double_booking();
