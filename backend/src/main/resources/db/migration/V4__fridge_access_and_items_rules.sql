
-- V4__fridge_access_and_items_rules.sql
-- Purpose: enforce bundle access by room-range rules, add compartment is_active,
--          convert compartments.type to ENUM, items status-time consistency,
--          and add GiST index for access queries.

BEGIN;

-- 0) Safety knobs (optional)
-- SET lock_timeout = '5s';
-- SET statement_timeout = '0';

-- A) Helper view (room numbers by user)
CREATE OR REPLACE VIEW users_with_room_no AS
SELECT u.user_id, r.room_number
FROM users u
LEFT JOIN dorm_rooms r ON r.dorm_room_id = u.dorm_room_id;

-- A) Enforce bundle access rights at COMMIT
CREATE OR REPLACE FUNCTION enforce_bundle_access()
RETURNS trigger AS $$
DECLARE
  v_room_no integer;
  v_exists  boolean;
BEGIN
  IF TG_OP IN ('INSERT','UPDATE') THEN
    SELECT r.room_number INTO v_room_no
    FROM users u JOIN dorm_rooms r ON r.dorm_room_id = u.dorm_room_id
    WHERE u.user_id = NEW.user_id;

    IF v_room_no IS NULL THEN
      RAISE EXCEPTION 'User % has no assigned room; cannot create bundle for compartment %',
        NEW.user_id, NEW.compartment_id;
    END IF;

    SELECT TRUE INTO v_exists
    FROM compartment_access_rules car
    WHERE car.compartment_id = NEW.compartment_id
      AND car.room_range @> v_room_no
    LIMIT 1;

    IF NOT v_exists THEN
      RAISE EXCEPTION 'Room % is not allowed to access compartment %', v_room_no, NEW.compartment_id;
    END IF;
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ctrg_bundles_access ON bundles;
CREATE CONSTRAINT TRIGGER ctrg_bundles_access
AFTER INSERT OR UPDATE OF user_id, compartment_id
ON bundles
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_bundle_access();

-- B) Compartment-level activation flag
ALTER TABLE compartments
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS ix_compartments_active ON compartments(is_active);

-- C) Convert type column to ENUM for safety
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'compartment_type') THEN
    CREATE TYPE compartment_type AS ENUM('REFRIGERATED','FREEZER');
  END IF;
END$$;

-- Optional: normalize existing values to expected set (uncomment if needed)
-- UPDATE compartments SET type = UPPER(type);

ALTER TABLE compartments
  ALTER COLUMN type TYPE compartment_type
  USING type::compartment_type;

-- D) Items status-time consistency + auto timestamp
ALTER TABLE items
  DROP CONSTRAINT IF EXISTS chk_items_discard_consistency;
ALTER TABLE items
  ADD  CONSTRAINT chk_items_discard_consistency
  CHECK (
    (status = 'STORED'    AND discarded_at IS NULL)
 OR (status = 'DISCARDED' AND discarded_at IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION set_discarded_timestamp()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'DISCARDED' AND NEW.discarded_at IS NULL THEN
    NEW.discarded_at := now();
  ELSIF NEW.status = 'STORED' THEN
    NEW.discarded_at := NULL;
  END IF;
  RETURN NEW;
END$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_items_discard_ts ON items;
CREATE TRIGGER trg_items_discard_ts
BEFORE INSERT OR UPDATE OF status ON items
FOR EACH ROW EXECUTE FUNCTION set_discarded_timestamp();

-- E) Query performance for access rules
CREATE INDEX IF NOT EXISTS ix_compartment_access_gist
ON compartment_access_rules
USING gist (room_range);

-- (Optional) Unique bundle names per user+compartment to avoid confusion
CREATE UNIQUE INDEX IF NOT EXISTS ux_bundles_name_per_user_compartment
ON bundles(user_id, compartment_id, bundle_name);

COMMIT;
