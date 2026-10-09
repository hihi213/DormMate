-- 계정 및 물품 없이 역할·호실·시설 기준 데이터만 구성한다.
-- DormMate 기본 시드
-- 근거: docs/data-model.md §4.1~§4.2
-- 목적: 역할 코드 및 층/호실 메타데이터를 초기화한다.
-- 정책: 반복 실행 시 안전하도록 ON CONFLICT/UPSERT 사용.

SET TIME ZONE 'UTC';

-- UUID 생성 함수가 없을 경우를 대비해 pgcrypto 확장 활성화
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==========================
-- 역할 코드 초기값
-- ==========================
INSERT INTO role (code, name, description, created_at, updated_at)
VALUES
    ('RESIDENT', '기숙사 거주자', '기본 거주자 권한', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('FLOOR_MANAGER', '층별장', '층별 냉장고 및 검사 담당자', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('ADMIN', '관리자', '시스템 전역 관리자', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (code) DO UPDATE
SET name        = EXCLUDED.name,
    description = EXCLUDED.description,
    updated_at   = CASE
                       WHEN (role.name, role.description) IS DISTINCT FROM (EXCLUDED.name, EXCLUDED.description)
                           THEN CURRENT_TIMESTAMP
                       ELSE role.updated_at
                   END;

-- ==========================
-- 층/호실 메타데이터
-- ==========================
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

-- 기본 냉장고 유닛/칸 메타데이터를 초기화한다.
-- 물품/포장은 Demo 초기화(R__demo_reset + Admin Seed)에서 관리한다.

SET TIME ZONE 'UTC';

WITH unit_defs AS (
    SELECT *
    FROM (VALUES
        (2, '2F-A'),
        (3, '3F-A'),
        (4, '4F-A'),
        (5, '5F-A')
    ) AS v(floor_no, display_name)
),
unit_insert AS (
    INSERT INTO fridge_unit (
        id,
        floor_no,
        display_name,
        status,
        created_at,
        updated_at
    )
    SELECT
        gen_random_uuid(),
        ud.floor_no,
        ud.display_name,
        'ACTIVE',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM unit_defs ud
    WHERE NOT EXISTS (
        SELECT 1
        FROM fridge_unit fu
        WHERE fu.floor_no = ud.floor_no
    )
    RETURNING id, floor_no
),
unit_update AS (
    UPDATE fridge_unit fu
    SET
        display_name = ud.display_name,
        status       = 'ACTIVE',
        retired_at   = NULL,
        updated_at   = CURRENT_TIMESTAMP
    FROM unit_defs ud
    WHERE fu.floor_no = ud.floor_no
      AND (
            fu.display_name IS DISTINCT FROM ud.display_name
         OR fu.status <> 'ACTIVE'
         OR fu.retired_at IS NOT NULL
      )
    RETURNING fu.id, fu.floor_no
),
unit_upsert AS (
    SELECT id, floor_no FROM unit_insert
    UNION
    SELECT id, floor_no FROM unit_update
    UNION
    SELECT id, floor_no
    FROM fridge_unit
    WHERE floor_no BETWEEN 2 AND 5
),
compartment_defs AS (
    SELECT *
    FROM (VALUES
        (2, 0, 'CHILL', 10),
        (2, 1, 'CHILL', 10),
        (2, 2, 'CHILL', 10),
        (2, 3, 'FREEZE', 6),
        (3, 0, 'CHILL', 10),
        (3, 1, 'CHILL', 10),
        (3, 2, 'CHILL', 10),
        (3, 3, 'FREEZE', 6),
        (4, 0, 'CHILL', 10),
        (4, 1, 'CHILL', 10),
        (4, 2, 'CHILL', 10),
        (4, 3, 'FREEZE', 6),
        (5, 0, 'CHILL', 10),
        (5, 1, 'CHILL', 10),
        (5, 2, 'CHILL', 10),
        (5, 3, 'FREEZE', 6)
    ) AS v(floor_no, slot_index, compartment_type, max_bundle_count)
),
compartment_upsert AS (
    INSERT INTO fridge_compartment (
        id,
        fridge_unit_id,
        compartment_type,
        max_bundle_count,
        locked_until,
        created_at,
        updated_at,
        slot_index,
        status,
        is_locked
    )
    SELECT
        COALESCE(
            (
                SELECT id
                FROM fridge_compartment
                WHERE fridge_unit_id = uu.id
                  AND slot_index = cd.slot_index
            ),
            gen_random_uuid()
        ),
        uu.id,
        cd.compartment_type,
        cd.max_bundle_count,
        NULL,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        cd.slot_index,
        'ACTIVE',
        FALSE
    FROM compartment_defs cd
    JOIN unit_upsert uu ON uu.floor_no = cd.floor_no
    ON CONFLICT (fridge_unit_id, slot_index) DO UPDATE
    SET
        compartment_type = EXCLUDED.compartment_type,
        max_bundle_count = EXCLUDED.max_bundle_count,
        status           = 'ACTIVE',
        is_locked        = FALSE,
        locked_until     = NULL,
        updated_at       = CURRENT_TIMESTAMP
    WHERE ROW(
            fridge_compartment.compartment_type,
            fridge_compartment.max_bundle_count,
            fridge_compartment.status,
            fridge_compartment.is_locked,
            fridge_compartment.locked_until
        )
        IS DISTINCT FROM ROW(
            EXCLUDED.compartment_type,
            EXCLUDED.max_bundle_count,
            'ACTIVE',
            FALSE,
            NULL
        )
    RETURNING id, fridge_unit_id, slot_index
),
all_compartments AS (
    SELECT fc.id, fu.floor_no, fc.slot_index
    FROM fridge_compartment fc
    JOIN fridge_unit fu ON fu.id = fc.fridge_unit_id
    WHERE fu.floor_no BETWEEN 2 AND 5
),
label_seq AS (
    INSERT INTO bundle_label_sequence (
        fridge_compartment_id,
        next_number,
        recycled_numbers,
        created_at,
        updated_at
    )
    SELECT
        ac.id,
        1,
        '[]'::jsonb,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM all_compartments ac
    ON CONFLICT (fridge_compartment_id) DO UPDATE
    SET
        next_number      = LEAST(bundle_label_sequence.next_number, EXCLUDED.next_number),
        recycled_numbers = '[]'::jsonb,
        updated_at       = CURRENT_TIMESTAMP
),
floor_rooms AS (
    SELECT
        r.id AS room_id,
        r.floor AS floor_no,
        r.room_number::INTEGER AS room_no
    FROM room r
    WHERE r.floor BETWEEN 2 AND 5
),
target_access AS (
    SELECT
        ac.id        AS compartment_id,
        fr.room_id   AS room_id
    FROM all_compartments ac
    JOIN floor_rooms fr ON fr.floor_no = ac.floor_no
    WHERE (ac.slot_index = 0 AND fr.room_no BETWEEN 1 AND 8)
       OR (ac.slot_index = 1 AND fr.room_no BETWEEN 9 AND 16)
       OR (ac.slot_index = 2 AND fr.room_no BETWEEN 17 AND 24)
       OR (ac.slot_index = 3)
)
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
    ta.compartment_id,
    ta.room_id,
    CURRENT_TIMESTAMP,
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM target_access ta
LEFT JOIN compartment_room_access cra
       ON cra.fridge_compartment_id = ta.compartment_id
      AND cra.room_id = ta.room_id
      AND cra.released_at IS NULL
WHERE cra.id IS NULL;
