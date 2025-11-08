-- Inspection audit log to track manual corrections and follow-up actions

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE inspection_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_session_id UUID NOT NULL REFERENCES inspection_session(id) ON DELETE CASCADE,
    action_type VARCHAR(64) NOT NULL,
    detail JSONB,
    created_by UUID REFERENCES dorm_user(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_inspection_audit_log_session ON inspection_audit_log (inspection_session_id);
CREATE INDEX idx_inspection_audit_log_created_at ON inspection_audit_log (created_at DESC);
