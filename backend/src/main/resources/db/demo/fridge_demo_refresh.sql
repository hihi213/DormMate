-- 냉장고 데모 데이터 리프레시 스크립트
-- 2F~5F 냉장고 리소스를 초기화하고 샘플 포장/물품을 재구성한다.

SET TIME ZONE 'UTC';

TRUNCATE TABLE
    inspection_action_item,
    inspection_action,
    unregistered_item_event,
    inspection_participant,
    inspection_session,
    fridge_item,
    fridge_bundle,
    bundle_label_sequence,
    compartment_room_access,
    fridge_compartment,
    fridge_unit
RESTART IDENTITY;

INSERT INTO fridge_unit (id, floor_no, display_name, status, retired_at, created_at, updated_at)
SELECT
    gen_random_uuid(),
    v.floor_no,
    v.display_name,
    'ACTIVE',
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (VALUES
    (2, '2F-A'),
    (3, '3F-A'),
    (4, '4F-A'),
    (5, '5F-A')
) AS v(floor_no, display_name);

INSERT INTO fridge_compartment (
    id,
    fridge_unit_id,
    slot_index,
    compartment_type,
    max_bundle_count,
    status,
    is_locked,
    locked_until,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    fu.id,
    cd.slot_index,
    cd.compartment_type,
    cd.max_bundle_count,
    'ACTIVE',
    FALSE,
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (VALUES
    (2, '2F-A', 0, 'CHILL', 3),
    (2, '2F-A', 1, 'CHILL', 999),
    (2, '2F-A', 2, 'CHILL', 999),
    (2, '2F-A', 3, 'FREEZE', 999),
    (3, '3F-A', 0, 'CHILL', 999),
    (3, '3F-A', 1, 'CHILL', 999),
    (3, '3F-A', 2, 'CHILL', 999),
    (3, '3F-A', 3, 'FREEZE', 999),
    (4, '4F-A', 0, 'CHILL', 999),
    (4, '4F-A', 1, 'CHILL', 999),
    (4, '4F-A', 2, 'CHILL', 999),
    (4, '4F-A', 3, 'FREEZE', 999),
    (5, '5F-A', 0, 'CHILL', 999),
    (5, '5F-A', 1, 'CHILL', 999),
    (5, '5F-A', 2, 'CHILL', 999),
    (5, '5F-A', 3, 'FREEZE', 999)
) AS cd(floor_no, unit_display_name, slot_index, compartment_type, max_bundle_count)
JOIN fridge_unit fu ON fu.floor_no = cd.floor_no AND fu.display_name = cd.unit_display_name;

INSERT INTO bundle_label_sequence (fridge_compartment_id, next_number, recycled_numbers, created_at, updated_at)
SELECT
    fc.id,
    1,
    '[]'::jsonb,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM fridge_compartment fc;

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
    fc.id,
    r.id,
    CURRENT_TIMESTAMP,
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM fridge_compartment fc
JOIN fridge_unit fu ON fu.id = fc.fridge_unit_id
JOIN room r ON r.floor = fu.floor_no
WHERE fc.slot_index = 3
   OR (
        fc.slot_index = 0 AND (r.room_number)::INT BETWEEN 1 AND 8
    )
   OR (
        fc.slot_index = 1 AND (r.room_number)::INT BETWEEN 9 AND 16
    )
   OR (
        fc.slot_index = 2 AND (r.room_number)::INT BETWEEN 17 AND 24
    );

-- 포장 샘플 삽입
WITH target_bundle AS (
    SELECT
        fu.display_name,
        fc.slot_index,
        fc.id AS compartment_id
    FROM fridge_compartment fc
    JOIN fridge_unit fu ON fu.id = fc.fridge_unit_id
)
INSERT INTO fridge_bundle (
    id,
    owner_user_id,
    fridge_compartment_id,
    label_number,
    bundle_name,
    memo,
    status,
    deleted_at,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    du.id,
    tb.compartment_id,
    data.label_number,
    data.bundle_name,
    data.memo,
    'ACTIVE',
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (VALUES
    ('alice', '2F-A', 0, 1, '앨리스 기본 식료품', '임박/만료 시나리오용 샘플 포장'),
    ('bob',   '2F-A', 0, 2, '밥 야식 재료',    '임박/만료 시나리오용 샘플 포장'),
    ('dylan', '2F-A', 2, 3, '딜런 비상 간식',  '야간 학습 대비 비상 식품'),
    ('diana', '3F-A', 0, 101, 'Diana 샘플 포장', '3층 5호실 검증용 포장'),
    ('eric',  '3F-A', 1, 201, 'Eric 관리 포장',  '층별장 점검용 포장'),
    ('fiona', '3F-A', 2, 301, 'Fiona 냉동 샘플', '3층 공용 검증용 냉동 포장')
) AS data(login_id, unit_display_name, slot_index, label_number, bundle_name, memo)
JOIN dorm_user du ON lower(du.login_id) = lower(data.login_id)
JOIN target_bundle tb ON tb.display_name = data.unit_display_name AND tb.slot_index = data.slot_index;

-- 물품 샘플 삽입
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
    fb.id,
    data.item_name,
    data.quantity,
    data.unit_code,
    data.expiry_date,
    'ACTIVE',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (VALUES
    ('2F-A', 0, 1, '우유', 1, '팩',  (CURRENT_DATE + INTERVAL '5 days')::DATE),
    ('2F-A', 0, 1, '계란', 10, '개',  (CURRENT_DATE + INTERVAL '2 days')::DATE),
    ('2F-A', 0, 2, '김치', 1, '통',   (CURRENT_DATE + INTERVAL '7 days')::DATE),
    ('2F-A', 0, 2, '떡볶이', 1, '팩', (CURRENT_DATE - INTERVAL '1 day')::DATE),
    ('2F-A', 2, 3, '컵라면', 3, '개', (CURRENT_DATE + INTERVAL '14 days')::DATE),
    ('2F-A', 2, 3, '초콜릿', 2, '개', (CURRENT_DATE + INTERVAL '21 days')::DATE),
    ('2F-A', 2, 3, '샌드위치', 2, '개', (CURRENT_DATE + INTERVAL '9 days')::DATE),
    ('3F-A', 0, 101, '샐러드', 1, '팩', (CURRENT_DATE + INTERVAL '4 days')::DATE),
    ('3F-A', 0, 101, '과일 세트', 1, '팩', (CURRENT_DATE + INTERVAL '11 days')::DATE),
    ('3F-A', 1, 201, '시금치', 1, '봉지', (CURRENT_DATE + INTERVAL '6 days')::DATE),
    ('3F-A', 2, 301, '만두', 12, '개', (CURRENT_DATE + INTERVAL '30 days')::DATE),
    ('3F-A', 2, 301, '비상 식량', 1, '박스', (CURRENT_DATE + INTERVAL '180 days')::DATE)
) AS data(unit_display_name, slot_index, label_number, item_name, quantity, unit_code, expiry_date)
JOIN fridge_bundle fb
  ON fb.fridge_compartment_id = (
        SELECT fc.id
        FROM fridge_compartment fc
        JOIN fridge_unit fu ON fu.id = fc.fridge_unit_id
        WHERE fu.display_name = data.unit_display_name
          AND fc.slot_index = data.slot_index
        LIMIT 1
    )
 AND fb.label_number = data.label_number;

UPDATE bundle_label_sequence bls
SET
    next_number = GREATEST(
        bls.next_number,
        COALESCE(
            (
                SELECT MAX(fb.label_number) + 1
                FROM fridge_bundle fb
                WHERE fb.fridge_compartment_id = bls.fridge_compartment_id
                  AND fb.status = 'ACTIVE'
            ),
            1
        )
    ),
    recycled_numbers = '[]'::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE bls.fridge_compartment_id IN (
    SELECT id FROM fridge_compartment
);

SELECT
    (SELECT COUNT(*) FROM fridge_unit)          AS unit_count,
    (SELECT COUNT(*) FROM fridge_compartment)   AS compartment_count,
    (SELECT COUNT(*) FROM fridge_bundle)        AS bundle_count,
    (SELECT COUNT(*) FROM fridge_item)          AS item_count;
