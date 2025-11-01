-- 접근권 정책에 맞지 않게 배치된 포장을 허용된 칸으로 이동시키고, 라벨 번호를 재할당한다.
-- 배경: V15에서 칸-호실 접근권을 재계산하면서 일부 기존 포장이 접근 불가능한 칸(slot_index=1 등)에 남아 있어
--       /fridge/bundles/{id} 호출 시 거주자가 403(FORBIDDEN_SLOT)을 받는 문제가 발생했다.
-- 정책: 각 호실은 compartment_room_access가 가리키는 칸만 사용할 수 있어야 하므로,
--       접근 불가 포장은 해당 호실에 허용된 칸 중 slot_index가 가장 낮은 칸으로 옮긴다.
--       라벨 번호는 대상 칸의 bundle_label_sequence.next_number부터 순차 배정한다.

SET TIME ZONE 'UTC';

WITH moved AS (
    SELECT DISTINCT ON (fb.id)
        fb.id AS bundle_id,
        alt_comp.id AS target_compartment_id
    FROM fridge_bundle fb
    JOIN room_assignment ra
        ON ra.dorm_user_id = fb.owner_user_id
       AND ra.released_at IS NULL
    JOIN compartment_room_access cra_alt
        ON cra_alt.room_id = ra.room_id
       AND cra_alt.released_at IS NULL
    JOIN fridge_compartment alt_comp
        ON alt_comp.id = cra_alt.fridge_compartment_id
    WHERE fb.status = 'ACTIVE'
      AND NOT EXISTS (
            SELECT 1
            FROM compartment_room_access cra_cur
            WHERE cra_cur.room_id = ra.room_id
              AND cra_cur.released_at IS NULL
              AND cra_cur.fridge_compartment_id = fb.fridge_compartment_id
        )
    ORDER BY fb.id, alt_comp.slot_index, alt_comp.id
),
numbered AS (
    SELECT
        m.bundle_id,
        m.target_compartment_id,
        bls.next_number
            + ROW_NUMBER() OVER (PARTITION BY m.target_compartment_id ORDER BY m.bundle_id) - 1 AS new_label
    FROM moved m
    JOIN bundle_label_sequence bls
        ON bls.fridge_compartment_id = m.target_compartment_id
),
updated AS (
    UPDATE fridge_bundle fb
    SET
        fridge_compartment_id = n.target_compartment_id,
        label_number = n.new_label,
        updated_at = CURRENT_TIMESTAMP
    FROM numbered n
    WHERE fb.id = n.bundle_id
    RETURNING fb.fridge_compartment_id
),
seq_update AS (
    UPDATE bundle_label_sequence bls
    SET
        next_number = bls.next_number + COALESCE(move_counts.cnt, 0),
        updated_at = CASE
            WHEN move_counts.cnt > 0 THEN CURRENT_TIMESTAMP
            ELSE bls.updated_at
        END
    FROM (
        SELECT
            n.target_compartment_id,
            COUNT(*) AS cnt
        FROM numbered n
        GROUP BY n.target_compartment_id
    ) AS move_counts
    WHERE bls.fridge_compartment_id = move_counts.target_compartment_id
    RETURNING 1
)
SELECT COUNT(*) AS moved_bundle_count
FROM updated;
