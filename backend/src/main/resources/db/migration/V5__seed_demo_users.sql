-- Demo 사용자 시드
-- 참고: docs/demo-scenario.md §2, docs/feature-inventory.md §1.2
-- 목적: 프론트엔드 데모 로그인에 사용할 alice/bob/carol 계정을 생성한다.

SET TIME ZONE 'UTC';

INSERT INTO role (code, name, description, created_at, updated_at)
VALUES
    ('RESIDENT', '기숙사 거주자', '기본 거주자 권한', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('FLOOR_MANAGER', '층별장', '층별 냉장고 담당자', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (code) DO UPDATE
SET name        = EXCLUDED.name,
    description = EXCLUDED.description,
    updated_at  = CURRENT_TIMESTAMP;

-- alice 계정 (거주자)
WITH target_user AS (
    SELECT COALESCE(
        (SELECT id FROM dorm_user WHERE login_id = 'alice'),
        gen_random_uuid()
    ) AS id
),
upsert_user AS (
    INSERT INTO dorm_user (id, login_id, password_hash, full_name, email, status, created_at, updated_at)
    SELECT
        id,
        'alice',
        crypt('alice123!', gen_salt('bf', 10)),
        'Alice Kim',
        'alice@dormmate.dev',
        'ACTIVE',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM target_user
    ON CONFLICT (login_id) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
    RETURNING id
),
role_resident AS (
    INSERT INTO user_role (id, dorm_user_id, role_code, granted_at, created_at, updated_at)
    SELECT gen_random_uuid(), id, 'RESIDENT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM upsert_user
    ON CONFLICT (dorm_user_id, role_code) WHERE revoked_at IS NULL DO UPDATE
    SET updated_at = CURRENT_TIMESTAMP
),
room_target AS (
    SELECT id FROM room WHERE floor = 2 AND room_number = '05' LIMIT 1
),
assignment_upsert AS (
    INSERT INTO room_assignment (id, room_id, dorm_user_id, personal_no, assigned_at, created_at, updated_at)
    SELECT
        gen_random_uuid(),
        room_target.id,
        upsert_user.id,
        1,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM upsert_user CROSS JOIN room_target
    ON CONFLICT (room_id, personal_no) WHERE released_at IS NULL DO UPDATE
    SET dorm_user_id = EXCLUDED.dorm_user_id,
        assigned_at = EXCLUDED.assigned_at,
        released_at = NULL,
        updated_at = CURRENT_TIMESTAMP
)
SELECT NULL;

-- dylan 계정 (2F 17호실 거주자)
WITH target_user AS (
    SELECT COALESCE(
        (SELECT id FROM dorm_user WHERE login_id = 'dylan'),
        gen_random_uuid()
    ) AS id
),
upsert_user AS (
    INSERT INTO dorm_user (id, login_id, password_hash, full_name, email, status, created_at, updated_at)
    SELECT
        id,
        'dylan',
        crypt('dylan123!', gen_salt('bf', 10)),
        'Dylan Choi',
        'dylan@dormmate.dev',
        'ACTIVE',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM target_user
    ON CONFLICT (login_id) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
    RETURNING id
),
role_resident AS (
    INSERT INTO user_role (id, dorm_user_id, role_code, granted_at, created_at, updated_at)
    SELECT gen_random_uuid(), id, 'RESIDENT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM upsert_user
    ON CONFLICT (dorm_user_id, role_code) WHERE revoked_at IS NULL DO UPDATE
    SET updated_at = CURRENT_TIMESTAMP
),
room_target AS (
    SELECT id FROM room WHERE floor = 2 AND room_number = '17' LIMIT 1
),
assignment_upsert AS (
    INSERT INTO room_assignment (id, room_id, dorm_user_id, personal_no, assigned_at, created_at, updated_at)
    SELECT
        gen_random_uuid(),
        room_target.id,
        upsert_user.id,
        2,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM upsert_user CROSS JOIN room_target
    ON CONFLICT (room_id, personal_no) WHERE released_at IS NULL DO UPDATE
    SET dorm_user_id = EXCLUDED.dorm_user_id,
        assigned_at = EXCLUDED.assigned_at,
        released_at = NULL,
        updated_at = CURRENT_TIMESTAMP
)
SELECT NULL;

-- diana 계정 (3F 05호실 거주자)
WITH target_user AS (
    SELECT COALESCE(
        (SELECT id FROM dorm_user WHERE login_id = 'diana'),
        gen_random_uuid()
    ) AS id
),
upsert_user AS (
    INSERT INTO dorm_user (id, login_id, password_hash, full_name, email, status, created_at, updated_at)
    SELECT
        id,
        'diana',
        crypt('diana123!', gen_salt('bf', 10)),
        'Diana Jung',
        'diana@dormmate.dev',
        'ACTIVE',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM target_user
    ON CONFLICT (login_id) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
    RETURNING id
),
role_resident AS (
    INSERT INTO user_role (id, dorm_user_id, role_code, granted_at, created_at, updated_at)
    SELECT gen_random_uuid(), id, 'RESIDENT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM upsert_user
    ON CONFLICT (dorm_user_id, role_code) WHERE revoked_at IS NULL DO UPDATE
    SET updated_at = CURRENT_TIMESTAMP
),
room_target AS (
    SELECT id FROM room WHERE floor = 3 AND room_number = '05' LIMIT 1
),
assignment_upsert AS (
    INSERT INTO room_assignment (id, room_id, dorm_user_id, personal_no, assigned_at, created_at, updated_at)
    SELECT
        gen_random_uuid(),
        room_target.id,
        upsert_user.id,
        1,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM upsert_user CROSS JOIN room_target
    ON CONFLICT (room_id, personal_no) WHERE released_at IS NULL DO UPDATE
    SET dorm_user_id = EXCLUDED.dorm_user_id,
        assigned_at = EXCLUDED.assigned_at,
        released_at = NULL,
        updated_at = CURRENT_TIMESTAMP
)
SELECT NULL;

-- eric 계정 (3F 13호실 거주자, 층별장)
WITH target_user AS (
    SELECT COALESCE(
        (SELECT id FROM dorm_user WHERE login_id = 'eric'),
        gen_random_uuid()
    ) AS id
),
upsert_user AS (
    INSERT INTO dorm_user (id, login_id, password_hash, full_name, email, status, created_at, updated_at)
    SELECT
        id,
        'eric',
        crypt('eric123!', gen_salt('bf', 10)),
        'Eric Han',
        'eric@dormmate.dev',
        'ACTIVE',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM target_user
    ON CONFLICT (login_id) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
    RETURNING id
),
role_resident AS (
    INSERT INTO user_role (id, dorm_user_id, role_code, granted_at, created_at, updated_at)
    SELECT gen_random_uuid(), id, 'RESIDENT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM upsert_user
    ON CONFLICT (dorm_user_id, role_code) WHERE revoked_at IS NULL DO UPDATE
    SET updated_at = CURRENT_TIMESTAMP
),
role_manager AS (
    INSERT INTO user_role (id, dorm_user_id, role_code, granted_at, created_at, updated_at)
    SELECT gen_random_uuid(), id, 'FLOOR_MANAGER', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM upsert_user
    ON CONFLICT (dorm_user_id, role_code) WHERE revoked_at IS NULL DO UPDATE
    SET updated_at = CURRENT_TIMESTAMP
),
room_target AS (
    SELECT id FROM room WHERE floor = 3 AND room_number = '13' LIMIT 1
),
assignment_upsert AS (
    INSERT INTO room_assignment (id, room_id, dorm_user_id, personal_no, assigned_at, created_at, updated_at)
    SELECT
        gen_random_uuid(),
        room_target.id,
        upsert_user.id,
        1,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM upsert_user CROSS JOIN room_target
    ON CONFLICT (room_id, personal_no) WHERE released_at IS NULL DO UPDATE
    SET dorm_user_id = EXCLUDED.dorm_user_id,
        assigned_at = EXCLUDED.assigned_at,
        released_at = NULL,
        updated_at = CURRENT_TIMESTAMP
)
SELECT NULL;

-- fiona 계정 (3F 24호실 거주자)
WITH target_user AS (
    SELECT COALESCE(
        (SELECT id FROM dorm_user WHERE login_id = 'fiona'),
        gen_random_uuid()
    ) AS id
),
upsert_user AS (
    INSERT INTO dorm_user (id, login_id, password_hash, full_name, email, status, created_at, updated_at)
    SELECT
        id,
        'fiona',
        crypt('fiona123!', gen_salt('bf', 10)),
        'Fiona Seo',
        'fiona@dormmate.dev',
        'ACTIVE',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM target_user
    ON CONFLICT (login_id) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
    RETURNING id
),
role_resident AS (
    INSERT INTO user_role (id, dorm_user_id, role_code, granted_at, created_at, updated_at)
    SELECT gen_random_uuid(), id, 'RESIDENT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM upsert_user
    ON CONFLICT (dorm_user_id, role_code) WHERE revoked_at IS NULL DO UPDATE
    SET updated_at = CURRENT_TIMESTAMP
),
room_target AS (
    SELECT id FROM room WHERE floor = 3 AND room_number = '24' LIMIT 1
),
assignment_upsert AS (
    INSERT INTO room_assignment (id, room_id, dorm_user_id, personal_no, assigned_at, created_at, updated_at)
    SELECT
        gen_random_uuid(),
        room_target.id,
        upsert_user.id,
        1,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM upsert_user CROSS JOIN room_target
    ON CONFLICT (room_id, personal_no) WHERE released_at IS NULL DO UPDATE
    SET dorm_user_id = EXCLUDED.dorm_user_id,
        assigned_at = EXCLUDED.assigned_at,
        released_at = NULL,
        updated_at = CURRENT_TIMESTAMP
)
SELECT NULL;

-- bob 계정 (층별장)
WITH target_user AS (
    SELECT COALESCE(
        (SELECT id FROM dorm_user WHERE login_id = 'bob'),
        gen_random_uuid()
    ) AS id
),
upsert_user AS (
    INSERT INTO dorm_user (id, login_id, password_hash, full_name, email, status, created_at, updated_at)
    SELECT
        id,
        'bob',
        crypt('bob123!', gen_salt('bf', 10)),
        'Bob Lee',
        'bob@dormmate.dev',
        'ACTIVE',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM target_user
    ON CONFLICT (login_id) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
    RETURNING id
),
role_resident AS (
    INSERT INTO user_role (id, dorm_user_id, role_code, granted_at, created_at, updated_at)
    SELECT gen_random_uuid(), id, 'RESIDENT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM upsert_user
    ON CONFLICT (dorm_user_id, role_code) WHERE revoked_at IS NULL DO UPDATE
    SET updated_at = CURRENT_TIMESTAMP
),
role_manager AS (
    INSERT INTO user_role (id, dorm_user_id, role_code, granted_at, created_at, updated_at)
    SELECT gen_random_uuid(), id, 'FLOOR_MANAGER', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM upsert_user
    ON CONFLICT (dorm_user_id, role_code) WHERE revoked_at IS NULL DO UPDATE
    SET updated_at = CURRENT_TIMESTAMP
),
room_target AS (
    SELECT id FROM room WHERE floor = 2 AND room_number = '05' LIMIT 1
),
assignment_upsert AS (
    INSERT INTO room_assignment (id, room_id, dorm_user_id, personal_no, assigned_at, created_at, updated_at)
    SELECT
        gen_random_uuid(),
        room_target.id,
        upsert_user.id,
        2,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM upsert_user CROSS JOIN room_target
    ON CONFLICT (room_id, personal_no) WHERE released_at IS NULL DO UPDATE
    SET dorm_user_id = EXCLUDED.dorm_user_id,
        assigned_at = EXCLUDED.assigned_at,
        released_at = NULL,
        updated_at = CURRENT_TIMESTAMP
)
SELECT NULL;

-- carol 계정 (거주자)
WITH target_user AS (
    SELECT COALESCE(
        (SELECT id FROM dorm_user WHERE login_id = 'carol'),
        gen_random_uuid()
    ) AS id
),
upsert_user AS (
    INSERT INTO dorm_user (id, login_id, password_hash, full_name, email, status, created_at, updated_at)
    SELECT
        id,
        'carol',
        crypt('carol123!', gen_salt('bf', 10)),
        'Carol Park',
        'carol@dormmate.dev',
        'ACTIVE',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM target_user
    ON CONFLICT (login_id) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
    RETURNING id
),
role_resident AS (
    INSERT INTO user_role (id, dorm_user_id, role_code, granted_at, created_at, updated_at)
    SELECT gen_random_uuid(), id, 'RESIDENT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM upsert_user
    ON CONFLICT (dorm_user_id, role_code) WHERE revoked_at IS NULL DO UPDATE
    SET updated_at = CURRENT_TIMESTAMP
),
room_target AS (
    SELECT id FROM room WHERE floor = 2 AND room_number = '06' LIMIT 1
),
assignment_upsert AS (
    INSERT INTO room_assignment (id, room_id, dorm_user_id, personal_no, assigned_at, created_at, updated_at)
    SELECT
        gen_random_uuid(),
        room_target.id,
        upsert_user.id,
        1,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM upsert_user CROSS JOIN room_target
    ON CONFLICT (room_id, personal_no) WHERE released_at IS NULL DO UPDATE
    SET dorm_user_id = EXCLUDED.dorm_user_id,
        assigned_at = EXCLUDED.assigned_at,
        released_at = NULL,
        updated_at = CURRENT_TIMESTAMP
)
SELECT NULL;
