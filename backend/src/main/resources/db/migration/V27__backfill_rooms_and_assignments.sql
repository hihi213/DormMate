-- 재배포 환경 백필: 기본 호실 메타데이터 및 거주자/데모 계정 배정 보정
-- - 2~5층 호실 정보를 최신 규칙으로 갱신한다.
-- - 데모 계정(alice/bob/...)의 배정과 권한을 복구한다.
-- - 비어 있는 슬롯에는 새로운 거주자 계정을 생성해 배정한다.

SET TIME ZONE 'UTC';

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 더 이상 사용하지 않는 구버전 함수 제거
DROP FUNCTION IF EXISTS public.fn_seed_demo_and_resident() CASCADE;
DROP FUNCTION IF EXISTS public.fn_rebuild_compartment_access() CASCADE;

WITH room_specs AS (
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
),
room_upsert AS (
    INSERT INTO room (id, floor, room_number, room_type, capacity, created_at, updated_at)
    SELECT
        COALESCE(
            (SELECT id FROM room WHERE floor = rs.floor AND room_number = rs.room_number),
            gen_random_uuid()
        ),
        rs.floor,
        rs.room_number,
        rs.room_type,
        rs.capacity,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM room_specs rs
    ON CONFLICT (floor, room_number) DO UPDATE
    SET room_type = EXCLUDED.room_type,
        capacity = EXCLUDED.capacity,
        updated_at = CASE
            WHEN room.room_type <> EXCLUDED.room_type OR room.capacity <> EXCLUDED.capacity
            THEN CURRENT_TIMESTAMP
            ELSE room.updated_at
        END
    RETURNING id, floor, room_number, capacity
)
SELECT 1;

-- 데모 사용자 권한 및 배정 복구
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
resolved_demo AS (
    SELECT du.id AS dorm_user_id, ds.login_id, ds.is_floor_manager
    FROM demo_seed ds
    JOIN dorm_user du ON du.login_id = ds.login_id
)
INSERT INTO user_role (id, dorm_user_id, role_code, granted_at, created_at, updated_at)
SELECT
    gen_random_uuid(),
    resolved_demo.dorm_user_id,
    CASE WHEN resolved_demo.is_floor_manager THEN 'FLOOR_MANAGER' ELSE 'RESIDENT' END,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM resolved_demo
ON CONFLICT (dorm_user_id, role_code) WHERE revoked_at IS NULL DO NOTHING;

WITH demo_targets AS (
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
    JOIN room r ON r.floor = ds.floor_no AND r.room_number = ds.room_number
)
UPDATE room_assignment ra
SET released_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
FROM demo_targets tgt
WHERE ra.dorm_user_id = tgt.dorm_user_id
  AND ra.released_at IS NULL
  AND ra.room_id <> tgt.room_id;

UPDATE room_assignment ra
SET released_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
FROM demo_targets tgt
WHERE ra.room_id = tgt.room_id
  AND ra.personal_no = tgt.personal_no
  AND ra.released_at IS NULL
  AND ra.dorm_user_id <> tgt.dorm_user_id;

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
FROM demo_targets tgt
ON CONFLICT (room_id, personal_no) WHERE released_at IS NULL DO UPDATE
SET dorm_user_id = EXCLUDED.dorm_user_id,
    assigned_at = EXCLUDED.assigned_at,
    released_at = NULL,
    updated_at = CURRENT_TIMESTAMP;

-- 비어 있는 슬롯에 신규 거주자 계정 생성
DROP TABLE IF EXISTS tmp_named_slots;
CREATE TEMP TABLE tmp_named_slots ON COMMIT DROP AS
WITH available_slots AS (
    SELECT
        r.id AS room_id,
        r.floor,
        r.room_number,
        slot.personal_no,
        concat(r.floor::text, r.room_number, '-', slot.personal_no::text) AS login_id,
        format('resident%s%s-%s@dormmate.dev', r.floor, r.room_number, slot.personal_no) AS email,
        ROW_NUMBER() OVER (
            PARTITION BY r.floor
            ORDER BY r.room_number::INTEGER, slot.personal_no
        ) AS floor_sequence
    FROM room_upsert r
    CROSS JOIN LATERAL generate_series(1, r.capacity) AS slot(personal_no)
    LEFT JOIN room_assignment ra
           ON ra.room_id = r.id
          AND ra.personal_no = slot.personal_no
          AND ra.released_at IS NULL
    WHERE r.floor BETWEEN 2 AND 5
      AND ra.id IS NULL
),
name_candidates AS (
    SELECT
        floor_val AS floor,
        ROW_NUMBER() OVER (
            PARTITION BY floor_val
            ORDER BY (given_ord * 53 + family_ord * 17), family_ord, given_ord
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
    CROSS JOIN LATERAL generate_series(2, 5) AS floor_val
),
named_slots AS (
    SELECT
        aslots.room_id,
        aslots.floor,
        aslots.room_number,
        aslots.personal_no,
        aslots.login_id,
        aslots.email,
        nc.full_name
    FROM available_slots aslots
    JOIN name_candidates nc
      ON nc.floor = aslots.floor
     AND nc.seq = aslots.floor_sequence
)
SELECT * FROM named_slots;

WITH user_upsert AS (
    INSERT INTO dorm_user (id, login_id, password_hash, full_name, email, status, created_at, updated_at)
    SELECT
        COALESCE((SELECT id FROM dorm_user WHERE login_id = ns.login_id), gen_random_uuid()),
        ns.login_id,
        crypt('user2025!', gen_salt('bf', 10)),
        ns.full_name,
        ns.email,
        'ACTIVE',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM tmp_named_slots ns
    ON CONFLICT (login_id) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
    RETURNING id, login_id
),
resident_role AS (
    INSERT INTO user_role (id, dorm_user_id, role_code, granted_at, created_at, updated_at)
    SELECT
        gen_random_uuid(),
        uu.id,
        'RESIDENT',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM user_upsert uu
    ON CONFLICT (dorm_user_id, role_code) WHERE revoked_at IS NULL DO NOTHING
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
    ns.room_id,
    du.id,
    ns.personal_no,
    CURRENT_TIMESTAMP,
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM tmp_named_slots ns
JOIN dorm_user du ON du.login_id = ns.login_id
ON CONFLICT (room_id, personal_no) WHERE released_at IS NULL DO NOTHING;

-- 칸-호실 접근 권한 재구성
DROP TABLE IF EXISTS tmp_active_compartments;
CREATE TEMP TABLE tmp_active_compartments ON COMMIT DROP AS
SELECT
    fc.id,
    fu.floor_no
FROM fridge_compartment fc
JOIN fridge_unit fu ON fu.id = fc.fridge_unit_id
WHERE fc.status = 'ACTIVE'
  AND fu.status = 'ACTIVE'
  AND fu.floor_no BETWEEN 2 AND 5;

DROP TABLE IF EXISTS tmp_rooms_on_floor;
CREATE TEMP TABLE tmp_rooms_on_floor ON COMMIT DROP AS
SELECT r.id AS room_id, r.floor, r.room_number::INTEGER AS room_no
FROM room r
WHERE r.floor BETWEEN 2 AND 5;

DELETE FROM compartment_room_access
WHERE fridge_compartment_id IN (SELECT id FROM tmp_active_compartments);

INSERT INTO compartment_room_access (
    id,
    fridge_compartment_id,
    room_id,
    assigned_at,
    released_at,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    ac.id,
    rf.room_id,
    CURRENT_TIMESTAMP,
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM tmp_active_compartments ac
JOIN tmp_rooms_on_floor rf ON rf.floor = ac.floor_no;

-- 레이블 시퀀스 초기화
INSERT INTO bundle_label_sequence (fridge_compartment_id, next_number, recycled_numbers, created_at, updated_at)
SELECT
    ac.id,
    1,
    '[]'::jsonb,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM tmp_active_compartments ac
ON CONFLICT (fridge_compartment_id) DO UPDATE
SET next_number = LEAST(EXCLUDED.next_number, bundle_label_sequence.next_number),
    recycled_numbers = '[]'::jsonb,
    updated_at = CURRENT_TIMESTAMP;
