-- Ensure updated_at column exists after V8 refactor removed it by mistake
ALTER TABLE compartment_room_access
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
