-- 신규 빈 운영 DB 전용. 기존 V1~V41 이력이 있는 DB에 적용하지 않는다.
-- 계정·비밀번호·업무 데이터 시드는 포함하지 않는다.
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- Source: V1__auth_core_schema.sql
-- AUTH-01 핵심 스키마 정의
-- 근거 문서: docs/data-model.md §4.1, docs/feature-inventory.md §1
-- 범위: dorm_user, signup_request, room, room_assignment, role, user_role, user_session

CREATE TABLE room (
    id              UUID PRIMARY KEY,
    floor           SMALLINT        NOT NULL,
    room_number     VARCHAR(4)      NOT NULL,
    room_type       VARCHAR(16)     NOT NULL,
    capacity        SMALLINT        NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_room_floor_number UNIQUE (floor, room_number),
    CONSTRAINT ck_room_type CHECK (room_type IN ('SINGLE', 'TRIPLE'))
);

CREATE TABLE dorm_user (
    id              UUID PRIMARY KEY,
    login_id        VARCHAR(50)     NOT NULL,
    password_hash   VARCHAR(255)    NOT NULL,
    full_name       VARCHAR(100)    NOT NULL,
    email           VARCHAR(320)    NOT NULL,
    status          VARCHAR(16)     NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deactivated_at  TIMESTAMPTZ,
    CONSTRAINT uq_dorm_user_login UNIQUE (login_id),
    CONSTRAINT ck_dorm_user_status CHECK (status IN ('PENDING', 'ACTIVE', 'INACTIVE'))
);

CREATE TABLE signup_request (
    id              UUID PRIMARY KEY,
    room_id         UUID            NOT NULL,
    personal_no     SMALLINT        NOT NULL,
    login_id        VARCHAR(50)     NOT NULL,
    email           VARCHAR(320)    NOT NULL,
    status          VARCHAR(16)     NOT NULL,
    submitted_at    TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_by     UUID,
    reviewed_at     TIMESTAMPTZ,
    decision_note   TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_signup_request_room FOREIGN KEY (room_id) REFERENCES room (id),
    CONSTRAINT fk_signup_request_reviewer FOREIGN KEY (reviewed_by) REFERENCES dorm_user (id),
    CONSTRAINT ck_signup_request_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'))
);

CREATE UNIQUE INDEX uq_signup_request_pending
    ON signup_request (room_id, personal_no)
    WHERE status = 'PENDING';

CREATE TABLE role (
    code        VARCHAR(32) PRIMARY KEY,
    name        VARCHAR(100)    NOT NULL,
    description VARCHAR(255),
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_role (
    id          UUID PRIMARY KEY,
    dorm_user_id UUID           NOT NULL,
    role_code    VARCHAR(32)    NOT NULL,
    granted_at   TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    granted_by   UUID,
    revoked_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_role_user FOREIGN KEY (dorm_user_id) REFERENCES dorm_user (id),
    CONSTRAINT fk_user_role_role FOREIGN KEY (role_code) REFERENCES role (code),
    CONSTRAINT fk_user_role_granted_by FOREIGN KEY (granted_by) REFERENCES dorm_user (id)
);

CREATE UNIQUE INDEX uq_user_role_active
    ON user_role (dorm_user_id, role_code)
    WHERE revoked_at IS NULL;

CREATE TABLE room_assignment (
    id              UUID PRIMARY KEY,
    room_id         UUID            NOT NULL,
    dorm_user_id    UUID            NOT NULL,
    personal_no     SMALLINT        NOT NULL,
    assigned_at     TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    released_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_room_assignment_room FOREIGN KEY (room_id) REFERENCES room (id),
    CONSTRAINT fk_room_assignment_user FOREIGN KEY (dorm_user_id) REFERENCES dorm_user (id)
);

CREATE UNIQUE INDEX uq_room_assignment_active
    ON room_assignment (room_id, personal_no)
    WHERE released_at IS NULL;

CREATE UNIQUE INDEX uq_room_assignment_user_active
    ON room_assignment (dorm_user_id)
    WHERE released_at IS NULL;

CREATE TABLE user_session (
    id              UUID PRIMARY KEY,
    dorm_user_id    UUID            NOT NULL,
    refresh_token   VARCHAR(255)    NOT NULL,
    issued_at       TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at      TIMESTAMPTZ     NOT NULL,
    revoked_at      TIMESTAMPTZ,
    revoked_reason  VARCHAR(100),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_session_user FOREIGN KEY (dorm_user_id) REFERENCES dorm_user (id),
    CONSTRAINT uq_user_session_token UNIQUE (refresh_token)
);

CREATE INDEX idx_user_session_active
    ON user_session (dorm_user_id, expires_at)
    WHERE revoked_at IS NULL;


-- Source: V4__fridge_inspection_notification_schema.sql
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


-- Source: V8__refactor_fridge_schema.sql
-- 냉장고/검사 스키마 리팩터링
-- 목적: slot_index 기반 라벨 관리, 공통 자원 상태 ENUM, UUID 검사 세션 등 최신 모델 반영

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- fridge_unit 조정
ALTER TABLE fridge_unit RENAME COLUMN floor TO floor_no;

ALTER TABLE fridge_unit
    ADD COLUMN display_name VARCHAR(50);

UPDATE fridge_unit
SET display_name = label
WHERE display_name IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_fridge_unit_display_name
    ON fridge_unit (display_name)
    WHERE display_name IS NOT NULL;

ALTER TABLE fridge_unit
    ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN retired_at TIMESTAMPTZ;

ALTER TABLE fridge_unit ADD CONSTRAINT ck_fridge_unit_status CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REPORTED', 'RETIRED'));

ALTER TABLE fridge_unit DROP CONSTRAINT IF EXISTS uq_fridge_unit_floor_label;
ALTER TABLE fridge_unit DROP CONSTRAINT IF EXISTS ck_fridge_unit_cold_type;

ALTER TABLE fridge_unit DROP COLUMN IF EXISTS label;
ALTER TABLE fridge_unit DROP COLUMN IF EXISTS cold_type;
ALTER TABLE fridge_unit DROP COLUMN IF EXISTS description;

-- fridge_compartment 리팩터링
ALTER TABLE fridge_compartment DROP CONSTRAINT IF EXISTS ck_fridge_compartment_type;

ALTER TABLE fridge_compartment ADD COLUMN slot_index INT;
UPDATE fridge_compartment SET slot_index = GREATEST(display_order - 1, 0) WHERE slot_index IS NULL;
ALTER TABLE fridge_compartment ALTER COLUMN slot_index SET NOT NULL;

ALTER TABLE fridge_compartment
    ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN is_locked BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE fridge_compartment ADD CONSTRAINT ck_fridge_compartment_status CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REPORTED', 'RETIRED'));

ALTER TABLE fridge_compartment ALTER COLUMN max_bundle_count TYPE INTEGER;

UPDATE fridge_compartment SET compartment_type = 'CHILL' WHERE compartment_type = 'REFRIGERATOR';
UPDATE fridge_compartment SET compartment_type = 'FREEZE' WHERE compartment_type = 'FREEZER';

ALTER TABLE fridge_compartment ADD CONSTRAINT ck_fridge_compartment_type CHECK (compartment_type IN ('CHILL', 'FREEZE'));

ALTER TABLE fridge_compartment DROP CONSTRAINT IF EXISTS uq_fridge_compartment_slot_code;
ALTER TABLE fridge_compartment DROP COLUMN IF EXISTS slot_code;

ALTER TABLE fridge_compartment DROP CONSTRAINT IF EXISTS uq_fridge_compartment_display;
ALTER TABLE fridge_compartment DROP COLUMN IF EXISTS display_order;

ALTER TABLE fridge_compartment DROP CONSTRAINT IF EXISTS ck_fridge_compartment_label_range;
ALTER TABLE fridge_compartment DROP COLUMN IF EXISTS label_range_start;
ALTER TABLE fridge_compartment DROP COLUMN IF EXISTS label_range_end;

ALTER TABLE fridge_compartment DROP COLUMN IF EXISTS is_active;

ALTER TABLE fridge_compartment ADD CONSTRAINT uq_fridge_compartment_slot UNIQUE (fridge_unit_id, slot_index);

-- compartment_room_access 단순화
DROP INDEX IF EXISTS uq_compartment_room_active;

ALTER TABLE compartment_room_access DROP COLUMN IF EXISTS priority_order;

CREATE INDEX idx_compartment_room_access_active
    ON compartment_room_access (fridge_compartment_id)
    WHERE released_at IS NULL;

CREATE INDEX idx_compartment_room_access_active_room
    ON compartment_room_access (room_id)
    WHERE released_at IS NULL;

-- bundle_label_sequence 정비
ALTER TABLE bundle_label_sequence RENAME COLUMN next_label TO next_number;
ALTER TABLE bundle_label_sequence ALTER COLUMN next_number TYPE INTEGER;
ALTER TABLE bundle_label_sequence ADD COLUMN recycled_numbers JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE bundle_label_sequence DROP CONSTRAINT IF EXISTS ck_bundle_label_range;
ALTER TABLE bundle_label_sequence ADD CONSTRAINT ck_bundle_label_range CHECK (next_number BETWEEN 1 AND 999);

-- fridge_bundle 구조 조정
DROP INDEX IF EXISTS uq_fridge_bundle_active_label;

ALTER TABLE fridge_bundle ADD COLUMN label_number INT;
UPDATE fridge_bundle SET label_number = label_code::INT;
ALTER TABLE fridge_bundle ALTER COLUMN label_number SET NOT NULL;
ALTER TABLE fridge_bundle DROP COLUMN IF EXISTS label_code;

ALTER TABLE fridge_bundle DROP COLUMN IF EXISTS visibility;

UPDATE fridge_bundle SET status = 'DELETED' WHERE status = 'REMOVED';

ALTER TABLE fridge_bundle DROP CONSTRAINT IF EXISTS ck_fridge_bundle_status;
ALTER TABLE fridge_bundle ADD CONSTRAINT ck_fridge_bundle_status CHECK (status IN ('ACTIVE', 'DELETED'));

CREATE UNIQUE INDEX uq_fridge_bundle_active_label
    ON fridge_bundle (fridge_compartment_id, label_number)
    WHERE status = 'ACTIVE';

-- fridge_item 구조 조정
DROP INDEX IF EXISTS uq_fridge_item_sequence;

ALTER TABLE fridge_item DROP CONSTRAINT IF EXISTS ck_fridge_item_status;
UPDATE fridge_item SET status = 'DELETED' WHERE status = 'REMOVED';

ALTER TABLE fridge_item DROP COLUMN IF EXISTS sequence_no;
ALTER TABLE fridge_item DROP COLUMN IF EXISTS priority;
ALTER TABLE fridge_item DROP COLUMN IF EXISTS last_modified_at;
ALTER TABLE fridge_item DROP COLUMN IF EXISTS last_modified_by;
ALTER TABLE fridge_item DROP COLUMN IF EXISTS memo;

ALTER TABLE fridge_item ADD COLUMN unit_code VARCHAR(16);
UPDATE fridge_item SET unit_code = unit WHERE unit_code IS NULL;
ALTER TABLE fridge_item DROP COLUMN IF EXISTS unit;

ALTER TABLE fridge_item ADD COLUMN expiry_date DATE;
UPDATE fridge_item SET expiry_date = expires_on WHERE expiry_date IS NULL;
ALTER TABLE fridge_item DROP COLUMN IF EXISTS expires_on;

ALTER TABLE fridge_item RENAME COLUMN post_inspection_modified TO updated_after_inspection;

ALTER TABLE fridge_item ADD CONSTRAINT ck_fridge_item_status CHECK (status IN ('ACTIVE', 'DELETED'));
CREATE INDEX idx_fridge_item_expiry_status ON fridge_item (expiry_date, status);

-- inspection_session을 UUID PK로 전환
ALTER TABLE inspection_session ADD COLUMN id_v2 UUID;
UPDATE inspection_session SET id_v2 = gen_random_uuid() WHERE id_v2 IS NULL;
ALTER TABLE inspection_session ALTER COLUMN id_v2 SET NOT NULL;

ALTER TABLE inspection_participant ADD COLUMN inspection_session_id_v2 UUID;
UPDATE inspection_participant ip
SET inspection_session_id_v2 = s.id_v2
FROM inspection_session s
WHERE ip.inspection_session_id = s.id;
ALTER TABLE inspection_participant ALTER COLUMN inspection_session_id_v2 SET NOT NULL;

ALTER TABLE inspection_action ADD COLUMN inspection_session_id_v2 UUID;
UPDATE inspection_action ia
SET inspection_session_id_v2 = s.id_v2
FROM inspection_session s
WHERE ia.inspection_session_id = s.id;
ALTER TABLE inspection_action ALTER COLUMN inspection_session_id_v2 SET NOT NULL;

ALTER TABLE unregistered_item_event ADD COLUMN inspection_session_id_v2 UUID;
UPDATE unregistered_item_event ue
SET inspection_session_id_v2 = s.id_v2
FROM inspection_session s
WHERE ue.inspection_session_id = s.id;
ALTER TABLE unregistered_item_event ALTER COLUMN inspection_session_id_v2 SET NOT NULL;

ALTER TABLE inspection_participant DROP CONSTRAINT IF EXISTS inspection_participant_inspection_session_id_fkey;
ALTER TABLE inspection_action DROP CONSTRAINT IF EXISTS inspection_action_inspection_session_id_fkey;
ALTER TABLE unregistered_item_event DROP CONSTRAINT IF EXISTS unregistered_item_event_inspection_session_id_fkey;

ALTER TABLE inspection_session DROP CONSTRAINT IF EXISTS inspection_session_pkey;
ALTER TABLE inspection_session DROP COLUMN id;
ALTER TABLE inspection_session RENAME COLUMN id_v2 TO id;
ALTER TABLE inspection_session ADD CONSTRAINT inspection_session_pkey PRIMARY KEY (id);
ALTER TABLE inspection_session ALTER COLUMN id SET DEFAULT gen_random_uuid();

DROP SEQUENCE IF EXISTS inspection_session_id_seq;

ALTER TABLE inspection_participant DROP COLUMN inspection_session_id;
ALTER TABLE inspection_participant RENAME COLUMN inspection_session_id_v2 TO inspection_session_id;
ALTER TABLE inspection_participant ADD CONSTRAINT fk_inspection_participant_session FOREIGN KEY (inspection_session_id) REFERENCES inspection_session (id) ON DELETE CASCADE;

CREATE UNIQUE INDEX uq_inspection_participant_active
    ON inspection_participant (inspection_session_id, dorm_user_id)
    WHERE left_at IS NULL;

ALTER TABLE inspection_action DROP COLUMN inspection_session_id;
ALTER TABLE inspection_action RENAME COLUMN inspection_session_id_v2 TO inspection_session_id;
ALTER TABLE inspection_action ADD CONSTRAINT fk_inspection_action_session FOREIGN KEY (inspection_session_id) REFERENCES inspection_session (id) ON DELETE CASCADE;

ALTER TABLE unregistered_item_event DROP COLUMN inspection_session_id;
ALTER TABLE unregistered_item_event RENAME COLUMN inspection_session_id_v2 TO inspection_session_id;
ALTER TABLE unregistered_item_event ADD CONSTRAINT fk_unregistered_item_event_session FOREIGN KEY (inspection_session_id) REFERENCES inspection_session (id) ON DELETE CASCADE;


-- Source: V9__restore_compartment_room_access_timestamp.sql
-- Ensure updated_at column exists after V8 refactor removed it by mistake
ALTER TABLE compartment_room_access
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- Source: V10__fridge_item_last_inspected_at.sql
-- 냉장고 물품 검사 추적 필드 재정비
-- 목적: updated_after_inspection 플래그를 제거하고 마지막 검사 시점을 기록

ALTER TABLE fridge_item
    ADD COLUMN last_inspected_at TIMESTAMPTZ;

ALTER TABLE fridge_item
    DROP COLUMN IF EXISTS updated_after_inspection;

CREATE INDEX IF NOT EXISTS idx_fridge_item_last_inspected_at
    ON fridge_item (last_inspected_at)
    WHERE last_inspected_at IS NOT NULL;


-- Source: V11__drop_notification_policy_table.sql
-- Remove legacy notification_policy table introduced for 확장 과제.
-- V4에서 생성됐던 구조를 안전하게 정리하고, Flyway checksum 충돌을 피하기 위해 별도 단계로 분리한다.

DROP TABLE IF EXISTS notification_policy;


-- Source: V12__add_user_session_device_id.sql
-- DormMate 인증 세션에 device_id 컬럼 추가
-- 근거: docs/feature-inventory.md §1, docs/ops/security-checklist.md §1

ALTER TABLE user_session
    ADD COLUMN IF NOT EXISTS device_id VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_user_session_device
    ON user_session (dorm_user_id, device_id)
    WHERE revoked_at IS NULL;


-- Source: V13__inspection_schedule_schema.sql
-- 냉장고 검사 일정 스케줄 테이블 생성
CREATE TABLE inspection_schedule (
    id UUID PRIMARY KEY,
    scheduled_at TIMESTAMPTZ NOT NULL,
    title VARCHAR(120),
    notes TEXT,
    status VARCHAR(16) NOT NULL DEFAULT 'SCHEDULED',
    completed_at TIMESTAMPTZ,
    inspection_session_id UUID REFERENCES inspection_session (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inspection_schedule_scheduled_at ON inspection_schedule (scheduled_at);
CREATE INDEX idx_inspection_schedule_status ON inspection_schedule (status);


-- Source: V17__create_penalty_history.sql
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


-- Source: V18__add_fridge_search_indexes.sql
-- 목적: 냉장고 검색 시 다자릿 슬롯 코드와 호실·보관자 키워드 조회 성능을 향상시키기 위한 보조 인덱스 추가
-- 근거: admin 포장 검색이 room_assignment 및 room 테이블에 대한 LIKE 검색을 수행하며, released_at=IS NULL 조건과 lower(room_number) 비교가 빈번함

CREATE INDEX IF NOT EXISTS idx_room_assignment_user_released
    ON room_assignment (dorm_user_id, released_at);

CREATE INDEX IF NOT EXISTS idx_room_room_number_lower
    ON room (LOWER(room_number));


-- Source: V19__add_inspection_correlation_columns.sql
ALTER TABLE inspection_action
    ADD COLUMN correlation_id uuid DEFAULT gen_random_uuid();

UPDATE inspection_action
SET correlation_id = gen_random_uuid()
WHERE correlation_id IS NULL;

ALTER TABLE inspection_action
    ALTER COLUMN correlation_id SET NOT NULL;

ALTER TABLE inspection_action_item
    ADD COLUMN correlation_id uuid;

UPDATE inspection_action_item i
SET correlation_id = a.correlation_id
FROM inspection_action a
WHERE i.inspection_action_id = a.id;

UPDATE inspection_action_item
SET correlation_id = gen_random_uuid()
WHERE correlation_id IS NULL;

ALTER TABLE inspection_action_item
    ALTER COLUMN correlation_id SET NOT NULL;

ALTER TABLE penalty_history
    ADD COLUMN correlation_id uuid;

UPDATE penalty_history ph
SET correlation_id = ia.correlation_id
FROM inspection_action ia
WHERE ph.inspection_action_id = ia.id
  AND ph.correlation_id IS NULL;

ALTER TABLE inspection_schedule
    ADD COLUMN fridge_compartment_id uuid;


-- Source: V20__add_inspection_initial_bundle_count.sql
ALTER TABLE inspection_session
    ADD COLUMN initial_bundle_count integer;


-- Source: V22__create_admin_policy_table.sql
-- 관리자 정책 테이블 생성

SET TIME ZONE 'UTC';

CREATE TABLE admin_policy (
    id UUID PRIMARY KEY,
    notification_batch_time TIME NOT NULL,
    notification_daily_limit INTEGER NOT NULL,
    notification_ttl_hours INTEGER NOT NULL,
    penalty_limit INTEGER NOT NULL,
    penalty_template TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO admin_policy (
    id,
    notification_batch_time,
    notification_daily_limit,
    notification_ttl_hours,
    penalty_limit,
    penalty_template
)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '09:00',
    20,
    24,
    10,
    'DormMate 벌점 누적 {점수}점으로 세탁실/다목적실/도서관 이용이 7일간 제한됩니다. 냉장고 기능은 유지됩니다.'
)
ON CONFLICT (id) DO UPDATE
SET notification_batch_time = EXCLUDED.notification_batch_time,
    notification_daily_limit = EXCLUDED.notification_daily_limit,
    notification_ttl_hours = EXCLUDED.notification_ttl_hours,
    penalty_limit = EXCLUDED.penalty_limit,
    penalty_template = EXCLUDED.penalty_template,
    updated_at = CURRENT_TIMESTAMP;


-- Source: V24__hash_existing_refresh_tokens.sql
-- 기존 평문 refresh_token을 SHA-256 해시로 변환한다.
-- 해시 기반 세션 검증으로 전환하면서 과거 세션이 모두 무효화되는 문제를 방지하기 위함이다.

SET TIME ZONE 'UTC';

DO $$
BEGIN
    -- pgcrypto 확장이 없으면 활성화한다.
    PERFORM 1
      FROM pg_catalog.pg_extension
     WHERE extname = 'pgcrypto';
    IF NOT FOUND THEN
        CREATE EXTENSION IF NOT EXISTS pgcrypto;
    END IF;
END $$;

UPDATE user_session
   SET refresh_token = encode(digest(refresh_token, 'sha256'), 'hex'),
       updated_at = CURRENT_TIMESTAMP
 WHERE length(refresh_token) <> 64;


-- Source: V25__ensure_inspection_schedule_fridge_compartment.sql
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'inspection_schedule'
          AND column_name = 'fridge_compartment_id'
    ) THEN
        ALTER TABLE inspection_schedule
            ADD COLUMN fridge_compartment_id uuid;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints tc
        WHERE tc.table_name = 'inspection_schedule'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND tc.constraint_name = 'fk_inspection_schedule_fridge_compartment'
    ) THEN
        ALTER TABLE inspection_schedule
            ADD CONSTRAINT fk_inspection_schedule_fridge_compartment
                FOREIGN KEY (fridge_compartment_id)
                REFERENCES fridge_compartment (id);
    END IF;
END $$;


-- Source: V26__add_unique_schedule_index.sql
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'uq_inspection_schedule_active_compartment_scheduled_at'
    ) THEN
        CREATE UNIQUE INDEX uq_inspection_schedule_active_compartment_scheduled_at
            ON inspection_schedule (fridge_compartment_id, scheduled_at)
            WHERE status = 'SCHEDULED' AND fridge_compartment_id IS NOT NULL;
    END IF;
END $$;


-- Source: V33__add_inspection_audit_log.sql
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


-- Source: V34__add_updated_at_to_inspection_audit_log.sql
ALTER TABLE inspection_audit_log
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ensure existing rows get updated timestamp
UPDATE inspection_audit_log
SET updated_at = COALESCE(updated_at, created_at);


-- Source: V35__add_slot_letter_function.sql
-- Helper to convert zero-based slot index to alphabetical code (A, B, ... , Z, AA, AB, ...)
-- Mirrors backend LabelFormatter.toSlotLetter behaviour so SQL queries can reuse identical logic.
CREATE OR REPLACE FUNCTION public.fn_slot_letter(slot_index INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
AS $function$
DECLARE
    v_index INTEGER := slot_index;
    v_result TEXT := '';
    v_remainder INTEGER;
BEGIN
    IF v_index IS NULL THEN
        RAISE EXCEPTION 'slot_index must not be null';
    END IF;
    IF v_index < 0 THEN
        RAISE EXCEPTION 'slot_index must be non-negative (got %)', v_index;
    END IF;

    LOOP
        v_remainder := v_index % 26;
        v_result := chr(65 + v_remainder) || v_result;
        v_index := v_index / 26 - 1;
        EXIT WHEN v_index < 0;
    END LOOP;

    RETURN v_result;
END;
$function$;


-- Source: V38__create_audit_log_table.sql
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


-- Source: V39__drop_unused_inspection_audit_log.sql
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inspection_audit_log') THEN
        DROP TABLE inspection_audit_log;
    END IF;
END $$;


-- Source: V40__add_allow_background_to_notification.sql
ALTER TABLE notification
    ADD COLUMN IF NOT EXISTS allow_background BOOLEAN NOT NULL DEFAULT TRUE;


-- Source: V41__rebuild_compartment_access_function.sql
-- 칸-호실 접근권을 정책에 따라 항상 일관되게 유지하기 위한 함수와 즉시 실행.

SET TIME ZONE 'UTC';

CREATE OR REPLACE FUNCTION public.fn_rebuild_compartment_room_access()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- 필수 테이블이 없다면 아무 작업도 하지 않는다.
    IF to_regclass('public.fridge_compartment') IS NULL
        OR to_regclass('public.compartment_room_access') IS NULL
        OR to_regclass('public.room') IS NULL THEN
        RAISE NOTICE 'Skipping compartment access rebuild: required tables missing';
        RETURN;
    END IF;

    WITH active_compartments AS (
        SELECT
            c.id,
            c.fridge_unit_id,
            c.slot_index,
            c.compartment_type,
            u.floor_no
        FROM fridge_compartment c
        JOIN fridge_unit u ON u.id = c.fridge_unit_id
        WHERE c.status = 'ACTIVE'
          AND u.status = 'ACTIVE'
    ),
    released AS (
        UPDATE compartment_room_access cra
        SET released_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE cra.released_at IS NULL
          AND cra.fridge_compartment_id IN (SELECT id FROM active_compartments)
        RETURNING 1
    ),
    rooms AS (
        SELECT
            r.id AS room_id,
            r.floor AS floor_no,
            CAST(r.room_number AS INTEGER) AS room_no,
            ROW_NUMBER() OVER (
                PARTITION BY r.floor
                ORDER BY CAST(r.room_number AS INTEGER)
            ) AS ordinal,
            COUNT(*) OVER (PARTITION BY r.floor) AS floor_room_count
        FROM room r
        WHERE r.floor BETWEEN 2 AND 5
    ),
    chill_counts AS (
        SELECT floor_no, COUNT(*) AS chill_count
        FROM active_compartments
        WHERE compartment_type = 'CHILL'
        GROUP BY floor_no
    ),
    chill_targets AS (
        SELECT
            ac.id AS compartment_id,
            rm.room_id
        FROM active_compartments ac
        JOIN chill_counts cc ON cc.floor_no = ac.floor_no
        JOIN rooms rm ON rm.floor_no = ac.floor_no
        WHERE ac.compartment_type = 'CHILL'
          AND cc.chill_count > 0
          AND FLOOR(((rm.ordinal - 1)::NUMERIC * cc.chill_count) / rm.floor_room_count) = ac.slot_index
    ),
    freeze_targets AS (
        SELECT
            ac.id AS compartment_id,
            rm.room_id
        FROM active_compartments ac
        JOIN rooms rm ON rm.floor_no = ac.floor_no
        WHERE ac.compartment_type = 'FREEZE'
    )
    INSERT INTO compartment_room_access (
        id,
        fridge_compartment_id,
        room_id,
        assigned_at,
        created_at,
        updated_at
    )
    SELECT
        gen_random_uuid(),
        tgt.compartment_id,
        tgt.room_id,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM (
        SELECT * FROM chill_targets
        UNION ALL
        SELECT * FROM freeze_targets
    ) AS tgt;
END;
$$;

SELECT public.fn_rebuild_compartment_room_access();


-- 냉장고 번들/방 권한 진단용 뷰
-- 목적: 번들 소유자 ↔ 방 배정 ↔ compartment 접근 권한이 불일치하는 케이스를 빠르게 조회
-- 사용 예시: SELECT * FROM vw_fridge_bundle_owner_mismatch LIMIT 20;

CREATE OR REPLACE VIEW vw_fridge_bundle_owner_mismatch AS
SELECT
    fb.id                     AS bundle_id,
    fb.bundle_name,
    fb.label_number,
    fb.owner_user_id,
    du.full_name              AS owner_name,
    du.login_id               AS owner_login_id,
    ra.room_id,
    r.room_number,
    r.floor                   AS room_floor,
    ra.personal_no,
    fb.fridge_compartment_id,
    fc.slot_index,
    fc.compartment_type,
    fu.floor_no               AS fridge_floor_no,
    fu.display_name           AS fridge_display_name,
    CASE
        WHEN ra.id IS NULL  THEN 'NO_ACTIVE_ROOM_ASSIGNMENT'
        WHEN cra.id IS NULL THEN 'ROOM_NOT_ALLOWED_FOR_COMPARTMENT'
        ELSE 'UNKNOWN'
    END                      AS issue_type,
    fb.created_at,
    fb.updated_at
FROM fridge_bundle fb
JOIN dorm_user du ON du.id = fb.owner_user_id
LEFT JOIN room_assignment ra
       ON ra.dorm_user_id = fb.owner_user_id
      AND ra.released_at IS NULL
LEFT JOIN room r ON r.id = ra.room_id
JOIN fridge_compartment fc ON fc.id = fb.fridge_compartment_id
JOIN fridge_unit fu ON fu.id = fc.fridge_unit_id
LEFT JOIN compartment_room_access cra
       ON cra.fridge_compartment_id = fb.fridge_compartment_id
      AND cra.room_id = ra.room_id
      AND cra.released_at IS NULL
WHERE fb.status = 'ACTIVE'
  AND fb.deleted_at IS NULL
  AND (ra.id IS NULL OR cra.id IS NULL);
