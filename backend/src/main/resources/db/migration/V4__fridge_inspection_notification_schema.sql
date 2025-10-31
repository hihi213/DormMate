-- 냉장고 / 검사 / 알림 핵심 스키마
-- 근거 문서: docs/data-model.md §4.2~§4.4, docs/feature-inventory.md §4~§5

CREATE TABLE fridge_unit (
    id UUID PRIMARY KEY,
    floor SMALLINT NOT NULL,
    label VARCHAR(20) NOT NULL,
    cold_type VARCHAR(16) NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_fridge_unit_floor_label UNIQUE (floor, label),
    CONSTRAINT ck_fridge_unit_cold_type CHECK (cold_type IN ('REFRIGERATOR', 'FREEZER'))
);

CREATE TABLE fridge_compartment (
    id UUID PRIMARY KEY,
    fridge_unit_id UUID NOT NULL REFERENCES fridge_unit (id),
    slot_code VARCHAR(24) NOT NULL,
    display_order SMALLINT NOT NULL,
    compartment_type VARCHAR(16) NOT NULL,
    max_bundle_count SMALLINT NOT NULL,
    label_range_start SMALLINT NOT NULL DEFAULT 1,
    label_range_end SMALLINT NOT NULL DEFAULT 999,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_fridge_compartment_slot_code UNIQUE (slot_code),
    CONSTRAINT uq_fridge_compartment_display UNIQUE (fridge_unit_id, display_order),
    CONSTRAINT ck_fridge_compartment_type CHECK (compartment_type IN ('REFRIGERATOR', 'FREEZER')),
    CONSTRAINT ck_fridge_compartment_label_range CHECK (label_range_start >= 0 AND label_range_end >= label_range_start)
);

CREATE TABLE compartment_room_access (
    id UUID PRIMARY KEY,
    fridge_compartment_id UUID NOT NULL REFERENCES fridge_compartment (id),
    room_id UUID NOT NULL REFERENCES room (id),
    priority_order SMALLINT NOT NULL DEFAULT 0,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    released_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX uq_compartment_room_active
    ON compartment_room_access (fridge_compartment_id, room_id)
    WHERE released_at IS NULL;

CREATE TABLE bundle_label_sequence (
    fridge_compartment_id UUID PRIMARY KEY REFERENCES fridge_compartment (id),
    next_label SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_bundle_label_range CHECK (next_label BETWEEN 1 AND 999)
);

CREATE TABLE fridge_bundle (
    id UUID PRIMARY KEY,
    owner_user_id UUID NOT NULL REFERENCES dorm_user (id),
    fridge_compartment_id UUID NOT NULL REFERENCES fridge_compartment (id),
    label_code VARCHAR(3) NOT NULL,
    bundle_name VARCHAR(120) NOT NULL,
    memo TEXT,
    visibility VARCHAR(16) NOT NULL DEFAULT 'OWNER_ONLY',
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_fridge_bundle_status CHECK (status IN ('ACTIVE', 'REMOVED')),
    CONSTRAINT ck_fridge_bundle_visibility CHECK (visibility IN ('OWNER_ONLY', 'SHARED'))
);

CREATE UNIQUE INDEX uq_fridge_bundle_active_label
    ON fridge_bundle (fridge_compartment_id, label_code)
    WHERE status = 'ACTIVE';

CREATE TABLE fridge_item (
    id UUID PRIMARY KEY,
    fridge_bundle_id UUID NOT NULL REFERENCES fridge_bundle (id),
    sequence_no INTEGER NOT NULL,
    item_name VARCHAR(120) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit VARCHAR(16),
    priority VARCHAR(16),
    expires_on DATE NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    last_modified_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_modified_by UUID REFERENCES dorm_user (id),
    post_inspection_modified BOOLEAN NOT NULL DEFAULT FALSE,
    memo TEXT,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_fridge_item_status CHECK (status IN ('ACTIVE', 'REMOVED')),
    CONSTRAINT ck_fridge_item_priority CHECK (priority IS NULL OR priority IN ('LOW', 'MEDIUM', 'HIGH'))
);

CREATE UNIQUE INDEX uq_fridge_item_sequence
    ON fridge_item (fridge_bundle_id, sequence_no)
    WHERE status = 'ACTIVE';

CREATE TABLE inspection_session (
    id BIGSERIAL PRIMARY KEY,
    fridge_compartment_id UUID NOT NULL REFERENCES fridge_compartment (id),
    started_by UUID NOT NULL REFERENCES dorm_user (id),
    status VARCHAR(16) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMPTZ,
    submitted_by UUID REFERENCES dorm_user (id),
    submitted_at TIMESTAMPTZ,
    total_bundle_count INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_inspection_session_status CHECK (status IN ('IN_PROGRESS', 'SUBMITTED', 'CANCELLED'))
);

CREATE TABLE inspection_participant (
    id BIGSERIAL PRIMARY KEY,
    inspection_session_id BIGINT NOT NULL REFERENCES inspection_session (id) ON DELETE CASCADE,
    dorm_user_id UUID NOT NULL REFERENCES dorm_user (id),
    role VARCHAR(16) NOT NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_inspection_participant_role CHECK (role IN ('LEAD', 'ASSIST'))
);

CREATE UNIQUE INDEX uq_inspection_participant_active
    ON inspection_participant (inspection_session_id, dorm_user_id)
    WHERE left_at IS NULL;

CREATE TABLE inspection_action (
    id BIGSERIAL PRIMARY KEY,
    inspection_session_id BIGINT NOT NULL REFERENCES inspection_session (id) ON DELETE CASCADE,
    fridge_bundle_id UUID REFERENCES fridge_bundle (id),
    target_user_id UUID REFERENCES dorm_user (id),
    action_type VARCHAR(32) NOT NULL,
    reason_code VARCHAR(32),
    free_note TEXT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    recorded_by UUID NOT NULL REFERENCES dorm_user (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_inspection_action_type CHECK (action_type IN ('WARN_INFO_MISMATCH', 'WARN_STORAGE_POOR', 'DISPOSE_EXPIRED', 'PASS', 'UNREGISTERED_DISPOSE'))
);

CREATE TABLE inspection_action_item (
    id BIGSERIAL PRIMARY KEY,
    inspection_action_id BIGINT NOT NULL REFERENCES inspection_action (id) ON DELETE CASCADE,
    fridge_item_id UUID REFERENCES fridge_item (id),
    snapshot_name VARCHAR(120),
    snapshot_expires_on DATE,
    quantity_at_action INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE unregistered_item_event (
    id BIGSERIAL PRIMARY KEY,
    inspection_session_id BIGINT NOT NULL REFERENCES inspection_session (id) ON DELETE CASCADE,
    reported_by UUID NOT NULL REFERENCES dorm_user (id),
    approx_room_id UUID REFERENCES room (id),
    item_description TEXT NOT NULL,
    disposed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notification (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES dorm_user (id),
    kind_code VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    state VARCHAR(16) NOT NULL,
    dedupe_key VARCHAR(100),
    ttl_at TIMESTAMPTZ,
    metadata JSONB,
    correlation_id UUID,
    read_at TIMESTAMPTZ,
    expired_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_notification_state CHECK (state IN ('UNREAD', 'READ', 'EXPIRED'))
);

CREATE INDEX idx_notification_user_state ON notification (user_id, state);

CREATE UNIQUE INDEX uq_notification_dedupe_active
    ON notification (user_id, kind_code, dedupe_key)
    WHERE dedupe_key IS NOT NULL AND state <> 'EXPIRED';

CREATE TABLE notification_preference (
    user_id UUID NOT NULL REFERENCES dorm_user (id),
    kind_code VARCHAR(50) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    allow_background BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, kind_code)
);

CREATE TABLE notification_dispatch_log (
    id BIGSERIAL PRIMARY KEY,
    notification_id UUID NOT NULL REFERENCES notification (id) ON DELETE CASCADE,
    channel VARCHAR(32) NOT NULL,
    status VARCHAR(16) NOT NULL,
    error_code VARCHAR(50),
    error_message TEXT,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_notification_dispatch_status CHECK (status IN ('SUCCESS', 'FAILED'))
);

CREATE INDEX idx_notification_dispatch_notification ON notification_dispatch_log (notification_id);

CREATE TABLE notification_policy (
    kind_code VARCHAR(50) PRIMARY KEY,
    ttl_hours INTEGER,
    max_per_day INTEGER,
    allow_background_default BOOLEAN,
    updated_by UUID REFERENCES dorm_user (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
