CREATE TABLE penalty_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES dorm_user (id),
    issuer_id UUID REFERENCES dorm_user (id),
    inspection_action_id BIGINT REFERENCES inspection_action (id) ON DELETE SET NULL,
    source VARCHAR(50) NOT NULL,
    points INTEGER NOT NULL,
    reason VARCHAR(120),
    issued_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_penalty_history_user ON penalty_history (user_id);
CREATE INDEX idx_penalty_history_source ON penalty_history (source);
CREATE INDEX idx_penalty_history_action ON penalty_history (inspection_action_id);
