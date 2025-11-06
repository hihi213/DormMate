-- 전시 일정(11/12~11/20) 기준 샘플 물품 시드
-- 목적: 기존 사용자/포장 데이터는 유지하면서 데모에 사용할 물품을 추가한다.

SET TIME ZONE 'UTC';

WITH target_bundles AS (
    SELECT
        fb.id AS bundle_id,
        ROW_NUMBER() OVER (ORDER BY fb.created_at, fb.id) AS rn
    FROM fridge_bundle fb
    WHERE fb.status = 'ACTIVE'
    ORDER BY fb.created_at, fb.id
    LIMIT 7
),
removed_existing AS (
    DELETE FROM fridge_item
    WHERE fridge_bundle_id IN (SELECT bundle_id FROM target_bundles)
      AND item_name LIKE '전시 데모:%'
    RETURNING id
),
item_defs AS (
    SELECT ROW_NUMBER() OVER () AS rn, item_name, quantity, unit_code, expiry_date
    FROM (VALUES
        ('전시 데모: D-1 샐러드', 1, '팩', DATE '2025-11-11'),
        ('전시 데모: 당일 도시락', 1, '팩', DATE '2025-11-12'),
        ('전시 데모: 야간 간식', 2, '팩', DATE '2025-11-13'),
        ('전시 데모: 점검 샘플', 1, '박스', DATE '2025-11-12'),
        ('전시 데모: 참여자 음료', 4, '병', DATE '2025-11-14'),
        ('전시 데모: 후속 간식', 3, '개', DATE '2025-11-16'),
        ('전시 데모: D+7 비상식', 1, '팩', DATE '2025-11-20')
    ) AS v(item_name, quantity, unit_code, expiry_date)
),
upsert_items AS (
    INSERT INTO fridge_item (
        id,
        fridge_bundle_id,
        item_name,
        quantity,
        unit_code,
        expiry_date,
        status,
        last_inspected_at,
        deleted_at,
        created_at,
        updated_at
    )
    SELECT
        gen_random_uuid(),
        tb.bundle_id,
        idf.item_name,
        idf.quantity,
        idf.unit_code,
        idf.expiry_date,
        'ACTIVE',
        NULL,
        NULL,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM target_bundles tb
    JOIN item_defs idf ON idf.rn = tb.rn
    RETURNING 1
)
SELECT COUNT(*) AS inserted_count
FROM upsert_items;

-- 자동 시드도 최신 상태로 재구성
SELECT public.fn_populate_fridge_auto_seed(20);
