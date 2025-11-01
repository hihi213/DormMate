-- 호실-칸 접근권을 실제 운영 규칙(냉장 칸당 8호실, 냉동 칸 전체 공유)에 맞춰 재계산한다.
-- 배경: V8 리팩터링 후 slot_code 기반 매핑이 제거되면서 임시로 1호실만 접근권이 남아 있었음.
--      본 스크립트는 활성 칸에 대한 기존 배정을 모두 해제한 뒤, 층/칸 타입별로 새 접근권을 부여한다.

SET TIME ZONE 'UTC';

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
        ROW_NUMBER() OVER (PARTITION BY r.floor ORDER BY CAST(r.room_number AS INTEGER)) AS ordinal,
        COUNT(*) OVER (PARTITION BY r.floor) AS floor_room_count
    FROM room r
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
) tgt;
