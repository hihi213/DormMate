ALTER TABLE inspection_audit_log
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ensure existing rows get updated timestamp
UPDATE inspection_audit_log
SET updated_at = COALESCE(updated_at, created_at);
