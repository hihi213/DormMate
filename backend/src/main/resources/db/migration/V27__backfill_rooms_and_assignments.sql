-- 최신 규칙에 맞춰 호실 메타데이터/거주자 계정/칸 접근 권한을 재구성한다.
-- - 2~5층 모든 호실은 1인실(SINGLE) 또는 3인실(TRIPLE) 규칙을 따른다.
-- - 기본 거주자 계정은 login_id = floorRoom-personal_no, 비밀번호 = "user2025!".
-- - 관리자는 거주 호실이 없다.

SET TIME ZONE 'UTC';

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 더 이상 사용하지 않는 데모용 함수 제거
DROP FUNCTION IF EXISTS public.fn_seed_demo_and_resident() CASCADE;
DROP FUNCTION IF EXISTS public.fn_rebuild_compartment_access() CASCADE;
DROP FUNCTION IF EXISTS public.fn_seed_fridge_presets() CASCADE;

DROP TABLE IF EXISTS tmp_named_slots;

CREATE TEMP TABLE tmp_named_slots ON COMMIT DROP AS
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
),
slot_plan AS (
    SELECT
        r.id AS room_id,
        r.floor,
        r.room_number,
        gs.personal_no,
        concat(r.floor::text, r.room_number, '-', gs.personal_no::text) AS login_id,
        format('resident%s%s-%s@dormmate.dev', r.floor, r.room_number, gs.personal_no) AS email,
        ROW_NUMBER() OVER (
            PARTITION BY r.floor
            ORDER BY r.room_number::INTEGER, gs.personal_no
        ) AS floor_sequence
    FROM room_upsert r
    CROSS JOIN LATERAL generate_series(1, r.capacity) AS gs(personal_no)
),
name_base AS (
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
),
name_pool AS (
    SELECT
        floor_val AS floor,
        nb.seq,
        nb.full_name
    FROM name_base nb
    CROSS JOIN LATERAL generate_series(2, 5) AS floor_val
),
named_slots AS (
    SELECT
        sp.room_id,
        sp.floor,
        sp.room_number,
        sp.personal_no,
        sp.login_id,
        sp.email,
        np.full_name
    FROM slot_plan sp
    JOIN name_pool np
      ON np.floor = sp.floor
     AND np.seq = sp.floor_sequence
)
SELECT * FROM named_slots;

-- 활성 배정을 모두 해제하고 최신 정보로 재구성
UPDATE room_assignment ra
   SET released_at = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP
 WHERE ra.released_at IS NULL
   AND ra.room_id IN (SELECT room_id FROM tmp_named_slots);

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
ON CONFLICT (room_id, personal_no) WHERE released_at IS NULL DO UPDATE
SET dorm_user_id = EXCLUDED.dorm_user_id,
    assigned_at = EXCLUDED.assigned_at,
    released_at = NULL,
    updated_at = CURRENT_TIMESTAMP;

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

-- 레이블 시퀀스가 존재하지 않는 칸은 초기화한다.
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
    updated_at = CURRENT_TIMESTAMP;
