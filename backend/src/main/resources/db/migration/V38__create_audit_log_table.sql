CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type VARCHAR(64) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    resource_key VARCHAR(128) NOT NULL,
    actor_user_id UUID REFERENCES dorm_user(id),
    correlation_id UUID,
    detail JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_log_created_at ON audit_log (created_at DESC);
CREATE INDEX idx_audit_log_resource ON audit_log (resource_type, resource_key, created_at DESC);
CREATE INDEX idx_audit_log_action ON audit_log (action_type, created_at DESC);
