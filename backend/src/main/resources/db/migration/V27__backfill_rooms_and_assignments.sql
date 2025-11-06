-- 재배포 환경 백필: 기본 호실 메타데이터 및 거주자/데모 계정 배정 보정
-- 배경: 초기 배포 시 R__Seed 가 뒤늦게 실행되어 room/room_assignment 시드가 누락됨.
-- 목적:
--   1. floors 2~5 의 room 메타데이터를 다시 삽입(존재 시 갱신)한다.
--   2. 데모 계정(alice/bob/...)의 호실 배정을 보정한다.
--   3. 비어 있는 슬롯에 기본 거주자(residentXYZ) 계정과 배정을 다시 생성한다.

SET TIME ZONE 'UTC';

-- pgcrypto는 암호 해시(crypt) 재생성에 필요하다.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.fn_rebuild_compartment_access()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    DROP TABLE IF EXISTS tmp_compartment_targets;

    CREATE TEMP TABLE tmp_compartment_targets ON COMMIT DROP AS
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
    rooms AS (
        SELECT
            r.id AS room_id,
            r.floor AS floor_no,
            CAST(r.room_number AS INTEGER) AS room_no,
            ROW_NUMBER() OVER (PARTITION BY r.floor ORDER BY CAST(r.room_number AS INTEGER)) AS ordinal,
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
          AND ac.slot_index < cc.chill_count
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
    SELECT DISTINCT compartment_id, room_id
    FROM (
        SELECT * FROM chill_targets
        UNION ALL
        SELECT * FROM freeze_targets
    ) t;

    DELETE FROM compartment_room_access
    WHERE fridge_compartment_id IN (
        SELECT DISTINCT compartment_id FROM tmp_compartment_targets
    );

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
        t.compartment_id,
        t.room_id,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM tmp_compartment_targets t;

    DROP TABLE IF EXISTS tmp_compartment_targets;
END;
$$;

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
    WITH base_slots AS (
        SELECT
            r.id AS room_id,
            r.floor AS floor_no,
            r.room_number AS room_number,
            slot.personal_no AS personal_no,
            concat(r.floor::text, r.room_number, '-', slot.personal_no::text) AS login_id,
            format('resident%s%s-%s@dormmate.dev', r.floor, r.room_number, slot.personal_no) AS email,
            ROW_NUMBER() OVER (
                ORDER BY r.floor, r.room_number::INTEGER, slot.personal_no
            ) AS global_seq
        FROM room r
        CROSS JOIN LATERAL generate_series(1, r.capacity) AS slot(personal_no)
        LEFT JOIN room_assignment ra
            ON ra.room_id = r.id
           AND ra.personal_no = slot.personal_no
           AND ra.released_at IS NULL
        WHERE r.floor BETWEEN 2 AND 5
          AND ra.id IS NULL
    ),
    max_seq AS (
        SELECT COALESCE(MAX(global_seq), 0) AS total_slots FROM base_slots
    ),
    name_pool AS (
        SELECT seq, full_name
        FROM (
            SELECT
                ROW_NUMBER() OVER (
                    ORDER BY (given_ord * 53 + family_ord * 17),
                             family_ord,
                             given_ord
                ) AS seq,
                fam || given AS full_name
            FROM unnest(ARRAY[
                '강','고','곽','구','권','김','노','류','문','박','배','서','손','송','신',
                '안','양','오','유','윤','이','임','장','전','정','조','차','최','한','허','홍'
            ]::text[]) WITH ORDINALITY AS f(fam, family_ord)
            CROSS JOIN unnest(ARRAY[
                '다연','지현','민재','가람','서율','다온','태린','시온','라희','하은',
                '준호','채윤','도원','세린','나율','예진','가율','도현','민서','다해',
                '서이','세아','윤후','재민','수현','태윤','라온','시우','다윤','서담',
                '지온','나리','하린','태이','주하','예린','시현','민호','서강','라온비',
                '하예린','서도윤','민서율','채아린','지호윤','다온슬','서리아','윤솔아','하로윤','민아설'
            ]::text[]) WITH ORDINALITY AS g(given, given_ord)
        ) np
        WHERE seq <= (SELECT total_slots FROM max_seq)
    ),
    named_slots AS (
        SELECT
            bs.room_id,
            bs.floor_no,
            bs.room_number,
            bs.personal_no,
            bs.login_id,
            bs.email,
            np.full_name
        FROM base_slots bs
        JOIN name_pool np ON np.seq = bs.global_seq
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
            ns.login_id,
            crypt(ns.login_id || 'user', gen_salt('bf', 10)),
            ns.full_name,
            ns.email,
            'ACTIVE',
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        FROM named_slots ns
        ON CONFLICT (login_id) DO UPDATE
        SET password_hash = EXCLUDED.password_hash,
            full_name   = EXCLUDED.full_name,
            email       = EXCLUDED.email,
            status      = EXCLUDED.status,
            updated_at  = CURRENT_TIMESTAMP
        RETURNING login_id
    ),
    resolved_users AS (
        SELECT
            ns.room_id,
            ns.personal_no,
            ns.login_id,
            du.id AS dorm_user_id
        FROM named_slots ns
        JOIN dorm_user du ON du.login_id = ns.login_id
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

    WITH base_slots AS (
        SELECT
            r.id AS room_id,
            r.floor AS floor_no,
            r.room_number AS room_number,
            slot.personal_no AS personal_no,
            concat(r.floor::text, r.room_number, '-', slot.personal_no::text) AS login_id,
            ROW_NUMBER() OVER (
                ORDER BY r.floor, r.room_number::INTEGER, slot.personal_no
            ) AS global_seq
        FROM room r
        CROSS JOIN LATERAL generate_series(1, r.capacity) AS slot(personal_no)
        LEFT JOIN room_assignment ra
            ON ra.room_id = r.id
           AND ra.personal_no = slot.personal_no
           AND ra.released_at IS NULL
        WHERE r.floor BETWEEN 2 AND 5
          AND ra.id IS NULL
    ),
    max_seq AS (
        SELECT COALESCE(MAX(global_seq), 0) AS total_slots FROM base_slots
    ),
    name_pool AS (
        SELECT seq, full_name
        FROM (
            SELECT
                ROW_NUMBER() OVER (
                    ORDER BY (given_ord * 53 + family_ord * 17),
                             family_ord,
                             given_ord
                ) AS seq,
                fam || given AS full_name
            FROM unnest(ARRAY[
                '강','고','곽','구','권','김','노','류','문','박','배','서','손','송','신',
                '안','양','오','유','윤','이','임','장','전','정','조','차','최','한','허','홍'
            ]::text[]) WITH ORDINALITY AS f(fam, family_ord)
            CROSS JOIN unnest(ARRAY[
                '다연','지현','민재','가람','서율','다온','태린','시온','라희','하은',
                '준호','채윤','도원','세린','나율','예진','가율','도현','민서','다해',
                '서이','세아','윤후','재민','수현','태윤','라온','시우','다윤','서담',
                '지온','나리','하린','태이','주하','예린','시현','민호','서강','라온비',
                '하예린','서도윤','민서율','채아린','지호윤','다온슬','서리아','윤솔아','하로윤','민아설'
            ]::text[]) WITH ORDINALITY AS g(given, given_ord)
        ) np
        WHERE seq <= (SELECT total_slots FROM max_seq)
    ),
    named_slots AS (
        SELECT
            bs.room_id,
            bs.personal_no,
            bs.login_id
        FROM base_slots bs
        JOIN name_pool np ON np.seq = bs.global_seq
    ),
    resolved_users AS (
        SELECT
            ns.room_id,
            ns.personal_no,
            ns.login_id,
            du.id AS dorm_user_id
        FROM named_slots ns
        JOIN dorm_user du ON du.login_id = ns.login_id
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

    PERFORM public.fn_rebuild_compartment_access();
END;
$$;

SELECT public.fn_seed_demo_and_resident();
