
-- V3__users_capacity_and_building.sql
-- Purpose: enforce room capacity & personal_number range, add building for multi-dorm,
--          add user ops meta, add/refresh occupancy view, and helpful indexes.

BEGIN;

-- 0) Safety: schema assumptions (optional; feel free to comment/uncomment)
-- SET lock_timeout = '5s';
-- SET statement_timeout = '0';

-- 1) Personal number must be positive (or NULL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_users_personal_number_positive'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT chk_users_personal_number_positive
      CHECK (personal_number IS NULL OR personal_number > 0);
  END IF;
END$$;

-- 2) Enforce room capacity + personal_number in [1..capacity] at COMMIT
CREATE OR REPLACE FUNCTION enforce_room_capacity_and_range()
RETURNS trigger AS $$
DECLARE
  v_capacity int;
  v_assigned_count int;
BEGIN
  IF NEW.dorm_room_id IS NULL OR NEW.personal_number IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT capacity INTO v_capacity
  FROM dorm_rooms WHERE dorm_room_id = NEW.dorm_room_id;
  IF v_capacity IS NULL THEN
    RAISE EXCEPTION 'Room(%) not found', NEW.dorm_room_id;
  END IF;

  -- (1) personal_number range
  IF NEW.personal_number < 1 OR NEW.personal_number > v_capacity THEN
    RAISE EXCEPTION 'personal_number(%) must be between 1 and room capacity(%)',
      NEW.personal_number, v_capacity;
  END IF;

  -- (2) capacity no exceed
  SELECT count(*) INTO v_assigned_count
  FROM users
  WHERE dorm_room_id = NEW.dorm_room_id
    AND personal_number IS NOT NULL
    AND user_id <> COALESCE(NEW.user_id, -1);

  IF (v_assigned_count + 1) > v_capacity THEN
    RAISE EXCEPTION 'Room(%) capacity exceeded: %/%',
      NEW.dorm_room_id, v_assigned_count + 1, v_capacity;
  END IF;

  RETURN NEW;
END$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_capacity_check ON users;
CREATE CONSTRAINT TRIGGER trg_users_capacity_check
AFTER INSERT OR UPDATE OF dorm_room_id, personal_number ON users
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_room_capacity_and_range();

-- 3) Multi-building support
ALTER TABLE dorm_rooms
  ADD COLUMN IF NOT EXISTS building varchar(50);

-- Backfill a default building label for existing rows (idempotent)
UPDATE dorm_rooms SET building = COALESCE(building, 'MAIN') WHERE building IS DISTINCT FROM 'MAIN';

-- Ensure NOT NULL (do after backfill)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='dorm_rooms' AND column_name='building' AND is_nullable='YES') THEN
    ALTER TABLE dorm_rooms ALTER COLUMN building SET NOT NULL;
  END IF;
END$$;

-- Convert UNIQUE(room_number) -> UNIQUE(building, room_number)
-- Attempt to drop common default names safely
ALTER TABLE dorm_rooms DROP CONSTRAINT IF EXISTS uk_room_number;
ALTER TABLE dorm_rooms DROP CONSTRAINT IF EXISTS dorm_rooms_room_number_key;

-- Create the new composite unique if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uk_building_room'
  ) THEN
    ALTER TABLE dorm_rooms
      ADD CONSTRAINT uk_building_room UNIQUE (building, room_number);
  END IF;
END$$;

-- 4) Helpful indexes
CREATE INDEX IF NOT EXISTS ix_dorm_rooms_floor ON dorm_rooms(building, floor);
CREATE INDEX IF NOT EXISTS ix_users_active       ON users(is_active);
CREATE INDEX IF NOT EXISTS ix_users_role         ON users(role_id);

-- 5) User operational metadata (optional but useful)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='last_login_at') THEN
    ALTER TABLE users ADD COLUMN last_login_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='password_updated_at') THEN
    ALTER TABLE users ADD COLUMN password_updated_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='deactivated_at') THEN
    ALTER TABLE users ADD COLUMN deactivated_at timestamptz;
  END IF;
END$$;

-- 6) Occupancy view (recreates safely)
CREATE OR REPLACE VIEW rooms_with_occupancy AS
SELECT r.dorm_room_id,
       r.building,
       r.room_number,
       r.floor,
       r.capacity,
       r.is_active,
       COUNT(u.user_id) FILTER (WHERE u.personal_number IS NOT NULL AND u.is_active) AS occupants,
       (r.capacity - COUNT(u.user_id) FILTER (WHERE u.personal_number IS NOT NULL AND u.is_active)) AS vacancies
FROM dorm_rooms r
LEFT JOIN users u ON u.dorm_room_id = r.dorm_room_id
GROUP BY r.dorm_room_id, r.building, r.room_number, r.floor, r.capacity, r.is_active;

COMMIT;
