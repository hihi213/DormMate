-- 기본 냉장고/물품 샘플 시드
-- 근거: docs/data-model.md §4.2, docs/demo-scenario.md §0. 사전 준비
-- 목적: 각 층 냉장고/칸/라벨 시퀀스 및 샘플 포장·물품 데이터를 초기화한다.
-- 정책: 반복 실행 시 안전하도록 UPSERT 패턴을 적용한다.

SET TIME ZONE 'UTC';

WITH unit_defs AS (
    SELECT *
    FROM (VALUES
        (2, '2F-A', 'REFRIGERATOR', '2층 기본 냉장/냉동 유닛'),
        (3, '3F-A', 'REFRIGERATOR', '3층 기본 냉장/냉동 유닛'),
        (4, '4F-A', 'REFRIGERATOR', '4층 기본 냉장/냉동 유닛'),
        (5, '5F-A', 'REFRIGERATOR', '5층 기본 냉장/냉동 유닛')
    ) AS v(floor, label, cold_type, description)
),
unit_upsert AS (
    INSERT INTO fridge_unit (id, floor, label, cold_type, description, created_at, updated_at)
    SELECT
        COALESCE(
            (SELECT id FROM fridge_unit WHERE floor = v.floor AND label = v.label),
            gen_random_uuid()
        ),
        v.floor,
        v.label,
        v.cold_type,
        v.description,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM unit_defs v
    ON CONFLICT (floor, label) DO UPDATE
    SET
        cold_type = EXCLUDED.cold_type,
        description = EXCLUDED.description,
        updated_at = CURRENT_TIMESTAMP
    RETURNING id, floor, label
),
compartment_defs AS (
    SELECT *
    FROM (VALUES
        (2, '2F-A', '2F-R1', 1, 'REFRIGERATOR', 999, 1, 999, 1, 8, FALSE, 3),
        (2, '2F-A', '2F-R2', 2, 'REFRIGERATOR', 999, 1, 999, 9, 16, FALSE, 1),
        (2, '2F-A', '2F-R3', 3, 'REFRIGERATOR', 999, 1, 999, 17, 24, FALSE, 1),
        (2, '2F-A', '2F-F1', 4, 'FREEZER', 999, 1, 999, NULL, NULL, TRUE, 1),
        (3, '3F-A', '3F-R1', 1, 'REFRIGERATOR', 999, 1, 999, 1, 8, FALSE, 1),
        (3, '3F-A', '3F-R2', 2, 'REFRIGERATOR', 999, 1, 999, 9, 16, FALSE, 1),
        (3, '3F-A', '3F-R3', 3, 'REFRIGERATOR', 999, 1, 999, 17, 24, FALSE, 1),
        (3, '3F-A', '3F-F1', 4, 'FREEZER', 999, 1, 999, NULL, NULL, TRUE, 1),
        (4, '4F-A', '4F-R1', 1, 'REFRIGERATOR', 999, 1, 999, 1, 8, FALSE, 1),
        (4, '4F-A', '4F-R2', 2, 'REFRIGERATOR', 999, 1, 999, 9, 16, FALSE, 1),
        (4, '4F-A', '4F-R3', 3, 'REFRIGERATOR', 999, 1, 999, 17, 24, FALSE, 1),
        (4, '4F-A', '4F-F1', 4, 'FREEZER', 999, 1, 999, NULL, NULL, TRUE, 1),
        (5, '5F-A', '5F-R1', 1, 'REFRIGERATOR', 999, 1, 999, 1, 8, FALSE, 1),
        (5, '5F-A', '5F-R2', 2, 'REFRIGERATOR', 999, 1, 999, 9, 16, FALSE, 1),
        (5, '5F-A', '5F-R3', 3, 'REFRIGERATOR', 999, 1, 999, 17, 24, FALSE, 1),
        (5, '5F-A', '5F-F1', 4, 'FREEZER', 999, 1, 999, NULL, NULL, TRUE, 1)
    ) AS v(
        floor,
        unit_label,
        slot_code,
        display_order,
        compartment_type,
        max_bundle_count,
        label_range_start,
        label_range_end,
        room_start,
        room_end,
        assign_all,
        next_label
    )
),
compartment_insert AS (
    INSERT INTO fridge_compartment (
        id,
        fridge_unit_id,
        slot_code,
        display_order,
        compartment_type,
        max_bundle_count,
        label_range_start,
        label_range_end,
        is_active,
        locked_until,
        created_at,
        updated_at
    )
    SELECT
        COALESCE(
            (SELECT id FROM fridge_compartment WHERE slot_code = cd.slot_code),
            gen_random_uuid()
        ),
        uu.id,
        cd.slot_code,
        cd.display_order,
        cd.compartment_type,
        cd.max_bundle_count,
        cd.label_range_start,
        cd.label_range_end,
        TRUE,
        NULL,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM compartment_defs cd
    JOIN unit_upsert uu ON uu.floor = cd.floor AND uu.label = cd.unit_label
    ON CONFLICT (slot_code) DO UPDATE
    SET
        fridge_unit_id = EXCLUDED.fridge_unit_id,
        display_order = EXCLUDED.display_order,
        compartment_type = EXCLUDED.compartment_type,
        max_bundle_count = EXCLUDED.max_bundle_count,
        label_range_start = EXCLUDED.label_range_start,
        label_range_end = EXCLUDED.label_range_end,
        updated_at = CURRENT_TIMESTAMP
    RETURNING id, slot_code
),
compartments AS (
    SELECT
        ci.id,
        cd.slot_code,
        cd.floor,
        cd.assign_all,
        cd.room_start,
        cd.room_end,
        cd.next_label
    FROM compartment_insert ci
    JOIN compartment_defs cd ON cd.slot_code = ci.slot_code
),
label_sequence_upsert AS (
    INSERT INTO bundle_label_sequence (fridge_compartment_id, next_label, created_at, updated_at)
    SELECT
        c.id,
        c.next_label,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM compartments c
    ON CONFLICT (fridge_compartment_id) DO UPDATE
    SET
        next_label = GREATEST(bundle_label_sequence.next_label, EXCLUDED.next_label),
        updated_at = CURRENT_TIMESTAMP
),
rooms AS (
    SELECT id, floor, room_number::INTEGER AS room_no
    FROM room
),
room_targets AS (
    SELECT
        c.id AS compartment_id,
        c.slot_code,
        r.id AS room_id,
        ROW_NUMBER() OVER (PARTITION BY c.slot_code ORDER BY r.room_no)::SMALLINT AS priority_order
    FROM compartments c
    JOIN rooms r ON r.floor = c.floor
    WHERE c.assign_all OR (r.room_no BETWEEN c.room_start AND c.room_end)
),
room_access_upsert AS (
    INSERT INTO compartment_room_access (id, fridge_compartment_id, room_id, priority_order, assigned_at)
    SELECT
        COALESCE(
            (
                SELECT id
                FROM compartment_room_access
                WHERE fridge_compartment_id = rt.compartment_id
                  AND room_id = rt.room_id
                  AND released_at IS NULL
            ),
            gen_random_uuid()
        ),
        rt.compartment_id,
        rt.room_id,
        rt.priority_order,
        CURRENT_TIMESTAMP
    FROM room_targets rt
    ON CONFLICT (id) DO UPDATE
    SET
        priority_order = EXCLUDED.priority_order,
        released_at = NULL,
        updated_at = CURRENT_TIMESTAMP
    RETURNING fridge_compartment_id, room_id
),
bundle_data AS (
    SELECT *
    FROM (VALUES
        ('alice', '2F-R1', '001', '앨리스 기본 식료품', '임박/만료 시나리오용 샘플 포장'),
        ('bob',   '2F-R1', '002', '밥 야식 재료',    '임박/만료 시나리오용 샘플 포장'),
        ('dylan', '2F-R3', '003', '딜런 비상 간식',  '야간 학습 대비 비상 식품'),
        ('diana', '3F-R1', '101', 'Diana 샘플 포장', '3층 5호실 검증용 포장'),
        ('eric',  '3F-R2', '201', 'Eric 관리 포장',  '층별장 점검용 포장'),
        ('fiona', '3F-R3', '301', 'Fiona 냉동 샘플', '3층 공용 검증용 냉동 포장')
    ) AS v(login_id, slot_code, label_code, bundle_name, memo)
),
seed_users AS (
    SELECT du.login_id, du.id
    FROM dorm_user du
    WHERE du.login_id IN (SELECT DISTINCT bd.login_id FROM bundle_data bd)
),
bundle_upsert AS (
    INSERT INTO fridge_bundle (
        id,
        owner_user_id,
        fridge_compartment_id,
        label_code,
        bundle_name,
        memo,
        visibility,
        status,
        deleted_at,
        created_at,
        updated_at
    )
    SELECT
        COALESCE(
            (
                SELECT id
                FROM fridge_bundle
                WHERE fridge_compartment_id = c.id
                  AND label_code = bd.label_code
            ),
            gen_random_uuid()
        ),
        su.id,
        c.id,
        bd.label_code,
        bd.bundle_name,
        bd.memo,
        'OWNER_ONLY',
        'ACTIVE',
        NULL,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM bundle_data bd
    JOIN seed_users su ON su.login_id = bd.login_id
    JOIN compartments c ON c.slot_code = bd.slot_code
    ON CONFLICT (id) DO UPDATE
    SET
        bundle_name = EXCLUDED.bundle_name,
        memo = EXCLUDED.memo,
        visibility = EXCLUDED.visibility,
        status = 'ACTIVE',
        deleted_at = NULL,
        updated_at = CURRENT_TIMESTAMP
    RETURNING id, fridge_compartment_id, owner_user_id AS owner_id, label_code
),
item_data AS (
    SELECT *
FROM (VALUES
        ('001', 1, '우유', 1, '팩',  'MEDIUM', (CURRENT_DATE + INTERVAL '5 days')::DATE, '냉장 보관 중. 임박 알림 확인용'),
        ('001', 2, '계란', 10, '개', 'HIGH',   (CURRENT_DATE + INTERVAL '2 days')::DATE, '소비 권장 D-2'),
        ('002', 1, '김치', 1, '통',  'LOW',    (CURRENT_DATE + INTERVAL '7 days')::DATE, '장기 보관 체크용'),
        ('002', 2, '떡볶이', 1, '팩', 'MEDIUM', (CURRENT_DATE - INTERVAL '1 day')::DATE, '검사 시 만료 확인용'),
        ('003', 1, '컵라면', 3, '개', 'LOW',   (CURRENT_DATE + INTERVAL '14 days')::DATE, '야식 대기 식품'),
        ('003', 2, '초콜릿', 2, '개', 'MEDIUM',(CURRENT_DATE + INTERVAL '21 days')::DATE, '당 충전용'),
        ('003', 3, '샌드위치', 2, '개', 'MEDIUM', (CURRENT_DATE + INTERVAL '9 days')::DATE, 'D-9 예시'),
        ('101', 1, '샐러드', 1, '팩', 'MEDIUM',(CURRENT_DATE + INTERVAL '4 days')::DATE, '가벼운 식사'),
        ('101', 2, '과일 세트', 1, '팩', 'MEDIUM', (CURRENT_DATE + INTERVAL '11 days')::DATE, 'D-11 예시'),
        ('201', 1, '시금치', 1, '봉지', 'LOW',(CURRENT_DATE + INTERVAL '6 days')::DATE, '층별장 검사용 신선 식품'),
        ('301', 1, '만두', 12, '개', 'LOW',   (CURRENT_DATE + INTERVAL '30 days')::DATE, '공용 냉동 식품'),
        ('301', 2, '비상 식량', 1, '박스', 'LOW', (CURRENT_DATE + INTERVAL '180 days')::DATE, '장기 보관용 비상 식량')
    ) AS v(label_code, sequence_no, item_name, quantity, unit, priority, expires_on, memo)
),
item_upsert AS (
    INSERT INTO fridge_item (
        id,
        fridge_bundle_id,
        sequence_no,
        item_name,
        quantity,
        unit,
        priority,
        expires_on,
        status,
        last_modified_at,
        last_modified_by,
        post_inspection_modified,
        memo,
        deleted_at,
        created_at,
        updated_at
    )
    SELECT
        COALESCE(
            (
                SELECT id
                FROM fridge_item
                WHERE fridge_bundle_id = bu.id
                  AND sequence_no = idt.sequence_no
            ),
            gen_random_uuid()
        ),
        bu.id,
        idt.sequence_no,
        idt.item_name,
        idt.quantity,
        idt.unit,
        idt.priority,
        idt.expires_on,
        'ACTIVE',
        CURRENT_TIMESTAMP,
        bu.owner_id,
        FALSE,
        idt.memo,
        NULL,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM item_data idt
    JOIN bundle_upsert bu ON bu.label_code = idt.label_code
    ON CONFLICT (id) DO UPDATE
    SET
        item_name = EXCLUDED.item_name,
        quantity = EXCLUDED.quantity,
        unit = EXCLUDED.unit,
        priority = EXCLUDED.priority,
        expires_on = EXCLUDED.expires_on,
        status = 'ACTIVE',
        last_modified_at = CURRENT_TIMESTAMP,
        last_modified_by = EXCLUDED.last_modified_by,
        post_inspection_modified = FALSE,
        memo = EXCLUDED.memo,
        deleted_at = NULL,
        updated_at = CURRENT_TIMESTAMP
)
SELECT NULL;

UPDATE fridge_compartment
SET max_bundle_count = 3,
    updated_at = CURRENT_TIMESTAMP
WHERE slot_code = '2F-R1';
