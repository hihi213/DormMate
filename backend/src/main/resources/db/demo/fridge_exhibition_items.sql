-- 전시 일정(11/12~11/20) 기준 샘플 물품 시드
-- 목적: 기존 사용자/포장 데이터는 유지하면서 데모에 사용할 물품을 추가한다.

SET TIME ZONE 'UTC';

WITH target_bundles AS (
    SELECT
        fb.id AS bundle_id,
        du.login_id
    FROM dorm_user du
    JOIN fridge_bundle fb ON fb.owner_user_id = du.id
    WHERE du.login_id IN ('alice', 'bob', 'dylan', 'diana', 'eric', 'fiona')
      AND fb.status = 'ACTIVE'
),
removed_existing AS (
    DELETE FROM fridge_item
    WHERE fridge_bundle_id IN (SELECT bundle_id FROM target_bundles)
      AND item_name LIKE '전시 데모:%'
    RETURNING id
),
item_defs AS (
    SELECT *
    FROM (VALUES
        ('alice', '전시 데모: D-1 샐러드', 1, '팩', DATE '2025-11-11'),
        ('alice', '전시 데모: 당일 도시락', 1, '팩', DATE '2025-11-12'),
        ('bob',   '전시 데모: 야간 간식', 2, '팩', DATE '2025-11-13'),
        ('eric',  '전시 데모: 점검 샘플', 1, '박스', DATE '2025-11-12'),
        ('diana', '전시 데모: 참여자 음료', 4, '병', DATE '2025-11-14'),
        ('dylan', '전시 데모: 후속 간식', 3, '개', DATE '2025-11-16'),
        ('fiona', '전시 데모: D+7 비상식', 1, '팩', DATE '2025-11-20')
    ) AS v(login_id, item_name, quantity, unit_code, expiry_date)
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
    FROM item_defs idf
    JOIN target_bundles tb ON tb.login_id = idf.login_id
    RETURNING 1
)
SELECT COUNT(*) AS inserted_count
FROM upsert_items;
