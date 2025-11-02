-- 2~5층 기본 거주자 계정 시드
-- 목적: 모든 호실·개인번호 슬롯에 기본 거주자 계정을 마련한다. 빈 슬롯만 대상으로 하여 기존 데모 계정은 유지한다.

SET TIME ZONE 'UTC';

WITH target_slots AS (
    SELECT
        r.id                                         AS room_id,
        r.floor                                      AS floor_no,
        r.room_number                                AS room_number,
        slot.personal_no                             AS personal_no,
        concat(r.floor::text, r.room_number, '-', slot.personal_no::text) AS login_id,
        format('기숙사생 %s%s-%s', r.floor, r.room_number, slot.personal_no) AS full_name,
        format('resident%s%s-%s@dormmate.dev', r.floor, r.room_number, slot.personal_no) AS email
    FROM room r
    CROSS JOIN LATERAL generate_series(1, r.capacity) AS slot(personal_no)
    LEFT JOIN room_assignment ra
        ON ra.room_id = r.id
       AND ra.personal_no = slot.personal_no
       AND ra.released_at IS NULL
    WHERE r.floor BETWEEN 2 AND 5
      AND ra.id IS NULL
),
upsert_users AS (
    INSERT INTO dorm_user (
        id,
        login_id,
        password_hash,
        full_name,
        email,
        status,
        created_at,
        updated_at
    )
    SELECT
        gen_random_uuid(),
        ts.login_id,
        crypt('Dormmate@2024', gen_salt('bf', 10)),
        ts.full_name,
        ts.email,
        'ACTIVE',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM target_slots ts
    ON CONFLICT (login_id) DO UPDATE
    SET full_name   = EXCLUDED.full_name,
        email       = EXCLUDED.email,
        status      = EXCLUDED.status,
        updated_at  = CURRENT_TIMESTAMP
    RETURNING login_id
),
resolved_users AS (
    SELECT
        ts.room_id,
        ts.floor_no,
        ts.room_number,
        ts.personal_no,
        ts.login_id,
        du.id AS dorm_user_id
    FROM target_slots ts
    JOIN dorm_user du ON du.login_id = ts.login_id
)
INSERT INTO user_role (
    id,
    dorm_user_id,
    role_code,
    granted_at,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    ru.dorm_user_id,
    'RESIDENT',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM resolved_users ru
LEFT JOIN user_role ur
       ON ur.dorm_user_id = ru.dorm_user_id
      AND ur.role_code = 'RESIDENT'
      AND ur.revoked_at IS NULL
WHERE ur.id IS NULL;

-- 빈 슬롯에 대해서만 호실 배정 생성
WITH target_slots AS (
    SELECT
        r.id                                         AS room_id,
        r.floor                                      AS floor_no,
        r.room_number                                AS room_number,
        slot.personal_no                             AS personal_no,
        concat(r.floor::text, r.room_number, '-', slot.personal_no::text) AS login_id
    FROM room r
    CROSS JOIN LATERAL generate_series(1, r.capacity) AS slot(personal_no)
    LEFT JOIN room_assignment ra
        ON ra.room_id = r.id
       AND ra.personal_no = slot.personal_no
       AND ra.released_at IS NULL
    WHERE r.floor BETWEEN 2 AND 5
      AND ra.id IS NULL
),
resolved_users AS (
    SELECT
        ts.room_id,
        ts.personal_no,
        ts.login_id,
        du.id AS dorm_user_id
    FROM target_slots ts
    JOIN dorm_user du ON du.login_id = ts.login_id
)
INSERT INTO room_assignment (
    id,
    room_id,
    dorm_user_id,
    personal_no,
    assigned_at,
    released_at,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    ru.room_id,
    ru.dorm_user_id,
    ru.personal_no,
    CURRENT_TIMESTAMP,
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM resolved_users ru;
