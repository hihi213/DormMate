-- 재배포 환경 백필: 기본 호실 메타데이터 및 거주자/데모 계정 배정 보정
-- 배경: 초기 배포 시 R__Seed 가 뒤늦게 실행되어 room/room_assignment 시드가 누락됨.
-- 목적:
--   1. floors 2~5 의 room 메타데이터를 다시 삽입(존재 시 갱신)한다.
--   2. 데모 계정(alice/bob/...)의 호실 배정을 보정한다.
--   3. 비어 있는 슬롯에 기본 거주자(residentXYZ) 계정과 배정을 다시 생성한다.

SET TIME ZONE 'UTC';

-- pgcrypto는 암호 해시(crypt) 재생성에 필요하다.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.fn_seed_demo_and_resident()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM set_config('TimeZone', 'UTC', true);

    -- 1) room 메타데이터 재삽입 (존재하면 업데이트)
    WITH raw_rooms AS (
        SELECT
            floor,
            LPAD(room_no::text, 2, '0') AS room_number,
            CASE
                WHEN (floor = 2 AND room_no IN (13, 24))
                  OR (floor IN (3, 4, 5) AND room_no = 13)
                THEN 1
                ELSE 3
            END AS capacity,
            CASE
                WHEN (floor = 2 AND room_no IN (13, 24))
                  OR (floor IN (3, 4, 5) AND room_no = 13)
                THEN 'SINGLE'
                ELSE 'TRIPLE'
            END AS room_type
        FROM generate_series(2, 5) AS floor
        CROSS JOIN generate_series(1, 24) AS room_no
    )
    INSERT INTO room (id, floor, room_number, room_type, capacity, created_at, updated_at)
    SELECT
        gen_random_uuid(),
        floor,
        room_number,
        room_type,
        capacity,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM raw_rooms
    ON CONFLICT (floor, room_number) DO UPDATE
    SET room_type = EXCLUDED.room_type,
        capacity  = EXCLUDED.capacity,
        updated_at = CASE
                         WHEN (room.room_type, room.capacity) IS DISTINCT FROM (EXCLUDED.room_type, EXCLUDED.capacity)
                             THEN CURRENT_TIMESTAMP
                         ELSE room.updated_at
                     END;

    -- 2) 데모 계정 보정 (사용자/권한/호실 배정)
    WITH demo_seed AS (
        SELECT *
        FROM (VALUES
            ('alice', 'alice123!', 'Alice Kim', 'alice@dormmate.dev', false, 2, '05', 1),
            ('bob',   'bob123!',   'Bob Lee',   'bob@dormmate.dev',   true,  2, '05', 2),
            ('carol', 'carol123!', 'Carol Park','carol@dormmate.dev', false, 2, '06', 1),
            ('dylan', 'dylan123!', 'Dylan Choi','dylan@dormmate.dev', false, 2, '17', 2),
            ('diana', 'diana123!', 'Diana Jung','diana@dormmate.dev', false, 3, '05', 1),
            ('eric',  'eric123!',  'Eric Han',  'eric@dormmate.dev',  true,  3, '13', 1),
            ('fiona', 'fiona123!', 'Fiona Seo', 'fiona@dormmate.dev', false, 3, '24', 1)
        ) AS v(login_id, raw_password, full_name, email, is_floor_manager, floor_no, room_number, personal_no)
    )
    INSERT INTO dorm_user (id, login_id, password_hash, full_name, email, status, created_at, updated_at)
    SELECT
        gen_random_uuid(),
        ds.login_id,
        crypt(ds.raw_password, gen_salt('bf', 10)),
        ds.full_name,
        ds.email,
        'ACTIVE',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM demo_seed ds
    ON CONFLICT (login_id) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        status = 'ACTIVE',
        updated_at = CURRENT_TIMESTAMP;

    WITH demo_seed AS (
        SELECT *
        FROM (VALUES
            ('alice', false),
            ('bob',   true ),
            ('carol', false),
            ('dylan', false),
            ('diana', false),
            ('eric',  true ),
            ('fiona', false)
        ) AS v(login_id, is_floor_manager)
    ),
    resolved AS (
        SELECT du.id AS dorm_user_id, ds.login_id, ds.is_floor_manager
        FROM demo_seed ds
        JOIN dorm_user du ON du.login_id = ds.login_id
    )
    INSERT INTO user_role (id, dorm_user_id, role_code, granted_at, created_at, updated_at)
    SELECT
        gen_random_uuid(),
        resolved.dorm_user_id,
        'RESIDENT',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM resolved
    ON CONFLICT (dorm_user_id, role_code) WHERE revoked_at IS NULL DO UPDATE
    SET updated_at = CURRENT_TIMESTAMP;

    WITH demo_seed AS (
        SELECT *
        FROM (VALUES
            ('bob'),
            ('eric')
        ) AS v(login_id)
    ),
    resolved AS (
        SELECT du.id AS dorm_user_id
        FROM demo_seed ds
        JOIN dorm_user du ON du.login_id = ds.login_id
    )
    INSERT INTO user_role (id, dorm_user_id, role_code, granted_at, created_at, updated_at)
    SELECT
        gen_random_uuid(),
        resolved.dorm_user_id,
        'FLOOR_MANAGER',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM resolved
    ON CONFLICT (dorm_user_id, role_code) WHERE revoked_at IS NULL DO UPDATE
    SET updated_at = CURRENT_TIMESTAMP;

    DROP TABLE IF EXISTS tmp_demo_targets;
    CREATE TEMP TABLE tmp_demo_targets ON COMMIT DROP AS
    SELECT
        du.id AS dorm_user_id,
        ds.floor_no,
        ds.room_number,
        ds.personal_no,
        r.id AS room_id
    FROM (
        SELECT *
        FROM (VALUES
            ('alice', 2, '05', 1),
            ('bob',   2, '05', 2),
            ('carol', 2, '06', 1),
            ('dylan', 2, '17', 2),
            ('diana', 3, '05', 1),
            ('eric',  3, '13', 1),
            ('fiona', 3, '24', 1)
        ) AS v(login_id, floor_no, room_number, personal_no)
    ) ds
    JOIN dorm_user du ON du.login_id = ds.login_id
    JOIN room r ON r.floor = ds.floor_no AND r.room_number = ds.room_number;

    -- 같은 사용자가 다른 호실에 배정되어 있으면 해제
    UPDATE room_assignment ra
    SET released_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    FROM tmp_demo_targets tgt
    WHERE ra.dorm_user_id = tgt.dorm_user_id
      AND ra.released_at IS NULL
      AND ra.room_id <> tgt.room_id;

    -- 타 사용자가 점유 중인 슬롯 해제
    UPDATE room_assignment ra
    SET released_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    FROM tmp_demo_targets tgt
    WHERE ra.room_id = tgt.room_id
      AND ra.personal_no = tgt.personal_no
      AND ra.released_at IS NULL
      AND ra.dorm_user_id <> tgt.dorm_user_id;

    -- 데모 사용자 재배정
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
        tgt.room_id,
        tgt.dorm_user_id,
        tgt.personal_no,
        CURRENT_TIMESTAMP,
        NULL,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM tmp_demo_targets tgt
    ON CONFLICT (room_id, personal_no) WHERE released_at IS NULL DO UPDATE
    SET dorm_user_id = EXCLUDED.dorm_user_id,
        assigned_at = EXCLUDED.assigned_at,
        released_at = NULL,
        updated_at = CURRENT_TIMESTAMP;

    -- 3) 빈 슬롯 대상 기본 거주자 계정 / 배정 재생성 (V21 논리 재사용)
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

    WITH target_slots AS (
        SELECT
            r.id                                         AS room_id,
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
END;
$$;

SELECT public.fn_seed_demo_and_resident();
