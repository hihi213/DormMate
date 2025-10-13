-- =========================
-- DormMate 초기 스키마 (PostgreSQL 전용)
-- 목적: 냉장고 관리 MVP 핵심 테이블, 제약, 트리거 정의
-- 정책: UTC 고정, snake_case 명명, ENUM 최소화, JSONB 사용
-- =========================

SET TIME ZONE 'UTC';

-- 대소문자 구분 없는 텍스트 비교를 위한 확장 (슈퍼유저 권한 필요)
CREATE EXTENSION IF NOT EXISTS citext;

-- ============
-- ENUM 타입 정의
-- ============
CREATE TYPE room_type AS ENUM ('SINGLE', 'TRIPLE');
CREATE TYPE user_role AS ENUM ('RESIDENT', 'INSPECTOR', 'ADMIN');
CREATE TYPE compartment_type AS ENUM ('FRIDGE', 'FREEZER');
CREATE TYPE inspection_session_status AS ENUM ('OPEN', 'SUBMITTED', 'CANCELLED');

-- ============
-- 코드 테이블
-- ============
CREATE TABLE bundle_status (
    code         VARCHAR(20) PRIMARY KEY,
    display_name VARCHAR(50) NOT NULL,
    description  TEXT,
    is_terminal  BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE item_state (
    code         VARCHAR(20) PRIMARY KEY,
    next_states  JSONB NOT NULL,
    is_terminal  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notification_kind (
    code       VARCHAR(30) PRIMARY KEY,
    module     VARCHAR(20) NOT NULL,
    severity   SMALLINT NOT NULL,
    ttl_hours  INTEGER NOT NULL,
    template   TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inspection_action_type (
    code             VARCHAR(30) PRIMARY KEY,
    requires_reason  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE warning_reason (
    code             VARCHAR(40) PRIMARY KEY,
    action_type_code VARCHAR(30) NOT NULL,
    CONSTRAINT fk_warning_reason_action
        FOREIGN KEY (action_type_code) REFERENCES inspection_action_type(code)
);

-- ============
-- 공통 도메인
-- ============
CREATE TABLE rooms (
    id          BIGSERIAL PRIMARY KEY,
    floor       SMALLINT NOT NULL,
    room_number VARCHAR(10) NOT NULL,
    capacity    SMALLINT NOT NULL,
    type        room_type NOT NULL,
    CONSTRAINT uq_rooms_floor_room UNIQUE (floor, room_number)
);
CREATE INDEX ix_rooms_floor ON rooms (floor);

CREATE TABLE users (
    id            BIGSERIAL PRIMARY KEY,
    email         VARCHAR(120) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    room_id       BIGINT,
    personal_no   SMALLINT,
    role          user_role NOT NULL,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at    TIMESTAMPTZ,
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT uq_users_room_person UNIQUE (room_id, personal_no),
    CONSTRAINT fk_users_room FOREIGN KEY (room_id) REFERENCES rooms(id)
);
CREATE INDEX ix_users_role_active ON users (role, is_active);

CREATE TABLE audit_logs (
    id                    BIGSERIAL PRIMARY KEY,
    actor_id              BIGINT,
    actor_role_at_action  VARCHAR(20),
    request_id            VARCHAR(36),
    scope                 VARCHAR(50) NOT NULL,
    ref_type              VARCHAR(50),
    ref_id                BIGINT,
    action                VARCHAR(100) NOT NULL,
    before_json           JSONB,
    after_json            JSONB,
    ip_address            VARCHAR(45),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ix_audit_logs_actor_time ON audit_logs (actor_id, created_at DESC);
CREATE INDEX ix_audit_logs_scope_ref ON audit_logs (scope, ref_id, created_at DESC);

-- ============
-- 냉장고 자원
-- ============
CREATE TABLE fridge_units (
    id        BIGSERIAL PRIMARY KEY,
    building  VARCHAR(20),
    floor     SMALLINT NOT NULL,
    unit_no   SMALLINT NOT NULL,
    CONSTRAINT uq_fridge_units_floor_no UNIQUE (floor, unit_no)
);
CREATE INDEX ix_fridge_units_floor ON fridge_units (floor);

CREATE TABLE compartments (
    id                    BIGSERIAL PRIMARY KEY,
    unit_id               BIGINT NOT NULL,
    slot_number           SMALLINT NOT NULL,
    type                  compartment_type NOT NULL,
    label_range_start     INTEGER NOT NULL,
    label_range_end       INTEGER NOT NULL,
    lock_owner_session_id UUID,
    lock_acquired_at      TIMESTAMPTZ,
    lock_expires_at       TIMESTAMPTZ,
    CONSTRAINT uq_compartments_unit_slot UNIQUE (unit_id, slot_number),
    CONSTRAINT fk_compartments_unit FOREIGN KEY (unit_id) REFERENCES fridge_units(id)
);
CREATE INDEX ix_compartments_lock_owner ON compartments (lock_owner_session_id);
CREATE INDEX ix_compartments_lock_exp ON compartments (lock_expires_at);

CREATE TABLE compartment_room_access (
    id              BIGSERIAL PRIMARY KEY,
    compartment_id  BIGINT NOT NULL,
    room_id         BIGINT NOT NULL,
    allocation_rule VARCHAR(50),
    active_from     DATE NOT NULL,
    active_to       DATE,
    CONSTRAINT fk_cra_compartment FOREIGN KEY (compartment_id) REFERENCES compartments(id),
    CONSTRAINT fk_cra_room FOREIGN KEY (room_id) REFERENCES rooms(id)
);
CREATE INDEX ix_cra_compartment_active ON compartment_room_access (compartment_id, active_to);
CREATE INDEX ix_cra_room_active ON compartment_room_access (room_id, active_to);

CREATE TABLE label_pool (
    compartment_id      BIGINT NOT NULL,
    label_number        INTEGER NOT NULL,
    status              SMALLINT NOT NULL DEFAULT 0,
    last_used_bundle_id BIGINT,
    last_used_at        TIMESTAMPTZ,
    PRIMARY KEY (compartment_id, label_number),
    CONSTRAINT fk_label_pool_compartment FOREIGN KEY (compartment_id) REFERENCES compartments(id)
);
CREATE INDEX ix_label_pool_status ON label_pool (compartment_id, status);

-- ============
-- 냉장고 데이터
-- ============
CREATE TABLE fridge_bundles (
    id               BIGSERIAL PRIMARY KEY,
    owner_id         BIGINT NOT NULL,
    compartment_id   BIGINT NOT NULL,
    label_code       VARCHAR(12) NOT NULL,
    bundle_name      VARCHAR(100),
    status_code      VARCHAR(20) NOT NULL,
    registered_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_modified_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_fridge_bundles_label UNIQUE (label_code),
    CONSTRAINT fk_fridge_bundles_owner FOREIGN KEY (owner_id) REFERENCES users(id),
    CONSTRAINT fk_fridge_bundles_compartment FOREIGN KEY (compartment_id) REFERENCES compartments(id),
    CONSTRAINT fk_fridge_bundles_status FOREIGN KEY (status_code) REFERENCES bundle_status(code)
);
CREATE INDEX ix_fridge_bundles_owner_status_reg ON fridge_bundles (owner_id, status_code, registered_at DESC);
CREATE INDEX ix_fridge_bundles_compartment_status ON fridge_bundles (compartment_id, status_code);
CREATE INDEX ix_fridge_bundles_compartment_modified ON fridge_bundles (compartment_id, last_modified_at DESC);

CREATE TABLE fridge_items (
    id          BIGSERIAL PRIMARY KEY,
    bundle_id   BIGINT NOT NULL,
    item_name   VARCHAR(100) NOT NULL,
    expiry_date DATE,
    state_code  VARCHAR(20) NOT NULL,
    memo        TEXT,
    CONSTRAINT fk_fridge_items_bundle FOREIGN KEY (bundle_id) REFERENCES fridge_bundles(id),
    CONSTRAINT fk_fridge_items_state FOREIGN KEY (state_code) REFERENCES item_state(code)
);
CREATE INDEX ix_fridge_items_bundle ON fridge_items (bundle_id);
CREATE INDEX ix_fridge_items_state_expiry ON fridge_items (state_code, expiry_date);

-- ============
-- 검사 시스템
-- ============
CREATE TABLE inspection_sessions (
    id            BIGSERIAL PRIMARY KEY,
    compartment_id BIGINT NOT NULL,
    session_uuid  UUID NOT NULL,
    status        inspection_session_status NOT NULL,
    started_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at      TIMESTAMPTZ,
    CONSTRAINT uq_inspection_sessions_uuid UNIQUE (session_uuid),
    CONSTRAINT fk_inspection_sessions_compartment FOREIGN KEY (compartment_id) REFERENCES compartments(id)
);
CREATE INDEX ix_inspection_sessions_compartment_status ON inspection_sessions (compartment_id, status);
CREATE INDEX ix_inspection_sessions_status_started ON inspection_sessions (status, started_at DESC);

CREATE TABLE inspection_inspectors (
    id           BIGSERIAL PRIMARY KEY,
    session_id   BIGINT NOT NULL,
    inspector_id BIGINT NOT NULL,
    joined_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_inspection_inspectors_session_user UNIQUE (session_id, inspector_id),
    CONSTRAINT fk_inspection_inspectors_session FOREIGN KEY (session_id) REFERENCES inspection_sessions(id),
    CONSTRAINT fk_inspection_inspectors_user FOREIGN KEY (inspector_id) REFERENCES users(id)
);
CREATE INDEX ix_inspection_inspectors_user ON inspection_inspectors (inspector_id);

CREATE TABLE inspection_actions (
    id               BIGSERIAL PRIMARY KEY,
    session_id       BIGINT NOT NULL,
    inspector_id     BIGINT NOT NULL,
    bundle_id        BIGINT,
    action_type_code VARCHAR(30) NOT NULL,
    reason_code      VARCHAR(40),
    memo             TEXT,
    unregistered_item_name VARCHAR(100),
    action_time      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_inspection_actions_session FOREIGN KEY (session_id) REFERENCES inspection_sessions(id),
    CONSTRAINT fk_inspection_actions_user FOREIGN KEY (inspector_id) REFERENCES users(id),
    CONSTRAINT fk_inspection_actions_bundle FOREIGN KEY (bundle_id) REFERENCES fridge_bundles(id),
    CONSTRAINT fk_inspection_actions_type FOREIGN KEY (action_type_code) REFERENCES inspection_action_type(code),
    CONSTRAINT fk_inspection_actions_reason FOREIGN KEY (reason_code) REFERENCES warning_reason(code)
);
CREATE INDEX ix_inspection_actions_session ON inspection_actions (session_id);
CREATE INDEX ix_inspection_actions_bundle ON inspection_actions (bundle_id);
CREATE INDEX ix_inspection_actions_type_time ON inspection_actions (action_type_code, action_time);

-- ============
-- 알림 테이블
-- ============
CREATE TABLE notifications (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT NOT NULL,
    kind_code           VARCHAR(30) NOT NULL,
    title               VARCHAR(100) NOT NULL,
    preview_json        JSONB,
    preview_summary     TEXT GENERATED ALWAYS AS (preview_json ->> 'summary') STORED,
    detail_json         JSONB,
    related_bundle_id   BIGINT,
    related_session_id  BIGINT,
    dedupe_key          CHAR(64) NOT NULL,
    is_read             BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ttl_at              TIMESTAMPTZ,
    CONSTRAINT uq_notifications_dedupe UNIQUE (dedupe_key),
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_notifications_kind FOREIGN KEY (kind_code) REFERENCES notification_kind(code),
    CONSTRAINT fk_notifications_bundle FOREIGN KEY (related_bundle_id) REFERENCES fridge_bundles(id) ON DELETE SET NULL,
    CONSTRAINT fk_notifications_session FOREIGN KEY (related_session_id) REFERENCES inspection_sessions(id) ON DELETE SET NULL,
    CONSTRAINT chk_notifications_related CHECK (
        (kind_code IN ('FRIDGE_EXPIRY', 'FRIDGE_OTHER') AND related_bundle_id IS NOT NULL) OR
        (kind_code IN ('INSPECTION_RESULT', 'INSPECTION_OTHER') AND related_session_id IS NOT NULL) OR
        (kind_code NOT IN ('FRIDGE_EXPIRY', 'FRIDGE_OTHER', 'INSPECTION_RESULT', 'INSPECTION_OTHER'))
    )
);
CREATE INDEX ix_notifications_list ON notifications (user_id, is_read, created_at DESC, id, kind_code);
CREATE INDEX ix_notifications_ttl ON notifications (ttl_at);
CREATE INDEX ix_notifications_bundle ON notifications (related_bundle_id);
CREATE INDEX ix_notifications_session ON notifications (related_session_id);
CREATE INDEX ix_notifications_preview_json_gin ON notifications USING GIN (preview_json);
CREATE INDEX ix_notifications_detail_json_gin ON notifications USING GIN (detail_json);

-- ============
-- 트리거 함수 및 트리거
-- ============
CREATE OR REPLACE FUNCTION fn_check_compartment_lock_window()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.lock_expires_at IS NOT NULL
       AND NEW.lock_acquired_at IS NOT NULL
       AND NEW.lock_expires_at <= NEW.lock_acquired_at THEN
        RAISE EXCEPTION 'lock_expires_at must be greater than lock_acquired_at';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_compartments_lock_window_ins
BEFORE INSERT ON compartments
FOR EACH ROW EXECUTE FUNCTION fn_check_compartment_lock_window();

CREATE TRIGGER trg_compartments_lock_window_upd
BEFORE UPDATE ON compartments
FOR EACH ROW EXECUTE FUNCTION fn_check_compartment_lock_window();

CREATE OR REPLACE FUNCTION fn_prevent_cra_overlap()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM compartment_room_access cra
        WHERE cra.compartment_id = NEW.compartment_id
          AND cra.room_id = NEW.room_id
          AND (TG_OP = 'INSERT' OR cra.id <> NEW.id)
          AND COALESCE(NEW.active_to, DATE '9999-12-31') >= cra.active_from
          AND COALESCE(cra.active_to, DATE '9999-12-31') >= NEW.active_from
    ) THEN
        RAISE EXCEPTION 'overlapping access period for room and compartment';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cra_no_overlap_ins
BEFORE INSERT ON compartment_room_access
FOR EACH ROW EXECUTE FUNCTION fn_prevent_cra_overlap();

CREATE TRIGGER trg_cra_no_overlap_upd
BEFORE UPDATE ON compartment_room_access
FOR EACH ROW EXECUTE FUNCTION fn_prevent_cra_overlap();

CREATE OR REPLACE FUNCTION fn_ensure_bundle_label_in_range()
RETURNS TRIGGER AS $$
DECLARE
    lb INTEGER;
    ub INTEGER;
    numeric_label INTEGER;
BEGIN
    IF POSITION('-' IN NEW.label_code) = 0 THEN
        RAISE EXCEPTION 'label_code must contain hyphen';
    END IF;

    SELECT label_range_start, label_range_end
      INTO lb, ub
    FROM compartments
    WHERE id = NEW.compartment_id;

    IF lb IS NULL OR ub IS NULL THEN
        RAISE EXCEPTION 'compartment % not found for label validation', NEW.compartment_id;
    END IF;

    numeric_label := split_part(NEW.label_code, '-', 2)::INTEGER;

    IF numeric_label < lb OR numeric_label > ub THEN
        RAISE EXCEPTION 'label out of range';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_fridge_bundles_label_range_ins
BEFORE INSERT ON fridge_bundles
FOR EACH ROW EXECUTE FUNCTION fn_ensure_bundle_label_in_range();

CREATE TRIGGER trg_fridge_bundles_label_range_upd
BEFORE UPDATE ON fridge_bundles
FOR EACH ROW EXECUTE FUNCTION fn_ensure_bundle_label_in_range();

CREATE OR REPLACE FUNCTION fn_release_label_on_removed()
RETURNS TRIGGER AS $$
DECLARE
    numeric_label INTEGER;
BEGIN
    IF OLD.status_code <> 'REMOVED' AND NEW.status_code = 'REMOVED' THEN
        numeric_label := split_part(NEW.label_code, '-', 2)::INTEGER;

        UPDATE label_pool
           SET status = 0,
               last_used_bundle_id = NEW.id,
               last_used_at = CURRENT_TIMESTAMP
         WHERE compartment_id = NEW.compartment_id
           AND label_number = numeric_label
           AND (status = 1 OR last_used_bundle_id IS NULL OR last_used_bundle_id = NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_fridge_bundles_release_label
AFTER UPDATE ON fridge_bundles
FOR EACH ROW EXECUTE FUNCTION fn_release_label_on_removed();

CREATE OR REPLACE FUNCTION fn_touch_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_touch_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION fn_touch_users_updated_at();

CREATE OR REPLACE FUNCTION fn_touch_fridge_bundles_last_modified()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_modified_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_fridge_bundles_touch_last_modified
BEFORE UPDATE ON fridge_bundles
FOR EACH ROW EXECUTE FUNCTION fn_touch_fridge_bundles_last_modified();
