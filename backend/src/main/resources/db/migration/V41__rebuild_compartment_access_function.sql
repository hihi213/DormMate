-- 칸-호실 접근권을 정책에 따라 항상 일관되게 유지하기 위한 함수와 즉시 실행.

SET TIME ZONE 'UTC';

CREATE OR REPLACE FUNCTION public.fn_rebuild_compartment_room_access()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- 필수 테이블이 없다면 아무 작업도 하지 않는다.
    IF to_regclass('public.fridge_compartment') IS NULL
        OR to_regclass('public.compartment_room_access') IS NULL
        OR to_regclass('public.room') IS NULL THEN
        RAISE NOTICE 'Skipping compartment access rebuild: required tables missing';
        RETURN;
    END IF;

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
            ROW_NUMBER() OVER (
                PARTITION BY r.floor
                ORDER BY CAST(r.room_number AS INTEGER)
            ) AS ordinal,
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
    ) AS tgt;
END;
$$;

SELECT public.fn_rebuild_compartment_room_access();
