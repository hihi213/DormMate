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
