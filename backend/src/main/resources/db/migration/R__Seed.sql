-- =========================
-- DormMate 기본 시드 (PostgreSQL 전용)
-- 목적: 코드 테이블, 샘플 계정/냉장고 데이터/알림 초기화
-- 정책: 재실행 시 안전하도록 ON CONFLICT / 존재 여부 검사 사용
-- =========================

SET TIME ZONE 'UTC';

-- ============
-- 코드 테이블 시드
-- ============
INSERT INTO bundle_status (code, display_name, description, is_terminal, sort_order)
VALUES
    ('NORMAL',  '정상',   '사용 가능한 상태', FALSE, 1),
    ('REMOVED', '삭제됨', '사용자 자진 삭제', TRUE,  2),
    ('DISPOSED','폐기됨', '검사로 폐기됨',   TRUE,  3)
ON CONFLICT (code) DO UPDATE
SET display_name = EXCLUDED.display_name,
    description  = EXCLUDED.description,
    is_terminal  = EXCLUDED.is_terminal,
    sort_order   = EXCLUDED.sort_order;

INSERT INTO item_state (code, next_states, is_terminal)
VALUES
    ('NORMAL',   jsonb_build_array('IMMINENT', 'DISPOSED'), FALSE),
    ('IMMINENT', jsonb_build_array('EXPIRED',  'DISPOSED'), FALSE),
    ('EXPIRED',  jsonb_build_array('DISPOSED'),             FALSE),
    ('DISPOSED', jsonb_build_array(),                       TRUE)
ON CONFLICT (code) DO UPDATE
SET next_states = EXCLUDED.next_states,
    is_terminal = EXCLUDED.is_terminal;

INSERT INTO inspection_action_type (code, requires_reason)
VALUES
    ('PASS',                 FALSE),
    ('WARN',                 TRUE),
    ('DISPOSE',              TRUE),
    ('UNREGISTERED_DISPOSE', TRUE)
ON CONFLICT (code) DO UPDATE
SET requires_reason = EXCLUDED.requires_reason;

INSERT INTO warning_reason (code, action_type_code)
VALUES
    ('INFO_MISMATCH',   'WARN'),
    ('STORAGE_ISSUE',   'WARN'),
    ('STICKER_MISSING', 'WARN')
ON CONFLICT (code) DO UPDATE
SET action_type_code = EXCLUDED.action_type_code;

INSERT INTO notification_kind (code, module, severity, ttl_hours, template)
VALUES
    ('FRIDGE_EXPIRY',     'FRIDGE', 3, 24, '임박: {{bundle}} {{count}}건'),
    ('INSPECTION_RESULT', 'FRIDGE', 4, 72, '검사 결과 요약'),
    ('ROOM_START',        'ROOM',   1, 24, '입사 안내')
ON CONFLICT (code) DO UPDATE
SET module    = EXCLUDED.module,
    severity  = EXCLUDED.severity,
    ttl_hours = EXCLUDED.ttl_hours,
    template  = EXCLUDED.template;

-- ============
-- 기본 공간
-- ============
WITH floors AS (SELECT unnest(ARRAY[2,3,4,5]) AS floor),
room_numbers AS (
    SELECT f.floor, generate_series(1, 24) AS room_no
    FROM floors f
),
room_data AS (
    SELECT
        floor,
        LPAD(room_no::text, 2, '0') AS room_number,
        CASE
            WHEN floor = 2 AND room_no IN (13, 24) THEN 1
            WHEN floor IN (3, 4, 5) AND room_no = 13 THEN 1
            ELSE 3
        END AS capacity,
        CASE
            WHEN floor = 2 AND room_no IN (13, 24) THEN 'SINGLE'
            WHEN floor IN (3, 4, 5) AND room_no = 13 THEN 'SINGLE'
            ELSE 'TRIPLE'
        END AS room_type
    FROM room_numbers
)
INSERT INTO rooms (floor, room_number, capacity, type)
SELECT floor,
       room_number,
       capacity,
       room_type::room_type
FROM room_data
ON CONFLICT (floor, room_number) DO UPDATE
SET capacity = EXCLUDED.capacity,
    type     = EXCLUDED.type;

-- ============
-- 기본 사용자
-- ============
INSERT INTO users (email, password_hash, room_id, personal_no, role, is_active)
VALUES
    ('a@dm.test',      '$2y$hash.admin', NULL, NULL, 'ADMIN'::user_role, TRUE),
    -- 2층 거주자
    ('201-1@test', '$$hash2011', (SELECT id FROM rooms WHERE floor = 2 AND room_number = '01'), 1, 'RESIDENT'::user_role, TRUE),
    ('201-2@test', '$$hash2012', (SELECT id FROM rooms WHERE floor = 2 AND room_number = '01'), 2, 'RESIDENT'::user_role, TRUE),
    ('201-3@test', '$$hash2013', (SELECT id FROM rooms WHERE floor = 2 AND room_number = '01'), 3, 'RESIDENT'::user_role, TRUE),
    ('202-1@test', '$$hash2021', (SELECT id FROM rooms WHERE floor = 2 AND room_number = '02'), 1, 'RESIDENT'::user_role, TRUE),
    ('202-2@test', '$$hash2022', (SELECT id FROM rooms WHERE floor = 2 AND room_number = '02'), 2, 'RESIDENT'::user_role, TRUE),
    ('202-3@test', '$$hash2023', (SELECT id FROM rooms WHERE floor = 2 AND room_number = '02'), 3, 'RESIDENT'::user_role, TRUE),
    ('213-1@test', '$$hash2131', (SELECT id FROM rooms WHERE floor = 2 AND room_number = '13'), 1, 'RESIDENT'::user_role, TRUE),
    ('224-1@test', '$$hash2241', (SELECT id FROM rooms WHERE floor = 2 AND room_number = '24'), 1, 'RESIDENT'::user_role, TRUE),
    -- 3층 거주자
    ('301-1@test', '$$hash3011', (SELECT id FROM rooms WHERE floor = 3 AND room_number = '01'), 1, 'RESIDENT'::user_role, TRUE),
    ('301-2@test', '$$hash3012', (SELECT id FROM rooms WHERE floor = 3 AND room_number = '01'), 2, 'RESIDENT'::user_role, TRUE),
    ('301-3@test', '$$hash3013', (SELECT id FROM rooms WHERE floor = 3 AND room_number = '01'), 3, 'RESIDENT'::user_role, TRUE),
    ('302-1@test', '$$hash3021', (SELECT id FROM rooms WHERE floor = 3 AND room_number = '02'), 1, 'RESIDENT'::user_role, TRUE),
    ('302-2@test', '$$hash3022', (SELECT id FROM rooms WHERE floor = 3 AND room_number = '02'), 2, 'RESIDENT'::user_role, TRUE),
    ('302-3@test', '$$hash3023', (SELECT id FROM rooms WHERE floor = 3 AND room_number = '02'), 3, 'RESIDENT'::user_role, TRUE),
    ('313-1@test', '$$hash3131', (SELECT id FROM rooms WHERE floor = 3 AND room_number = '13'), 1, 'RESIDENT'::user_role, TRUE),
    -- 4층 거주자
    ('401-1@test', '$$hash4011', (SELECT id FROM rooms WHERE floor = 4 AND room_number = '01'), 1, 'RESIDENT'::user_role, TRUE),
    ('401-2@test', '$$hash4012', (SELECT id FROM rooms WHERE floor = 4 AND room_number = '01'), 2, 'RESIDENT'::user_role, TRUE),
    ('401-3@test', '$$hash4013', (SELECT id FROM rooms WHERE floor = 4 AND room_number = '01'), 3, 'RESIDENT'::user_role, TRUE),
    ('402-1@test', '$$hash4021', (SELECT id FROM rooms WHERE floor = 4 AND room_number = '02'), 1, 'RESIDENT'::user_role, TRUE),
    ('402-2@test', '$$hash4022', (SELECT id FROM rooms WHERE floor = 4 AND room_number = '02'), 2, 'RESIDENT'::user_role, TRUE),
    ('402-3@test', '$$hash4023', (SELECT id FROM rooms WHERE floor = 4 AND room_number = '02'), 3, 'RESIDENT'::user_role, TRUE),
    ('413-1@test', '$$hash4131', (SELECT id FROM rooms WHERE floor = 4 AND room_number = '13'), 1, 'RESIDENT'::user_role, TRUE),
    -- 5층 거주자
    ('501-1@test', '$$hash5011', (SELECT id FROM rooms WHERE floor = 5 AND room_number = '01'), 1, 'RESIDENT'::user_role, TRUE),
    ('501-2@test', '$$hash5012', (SELECT id FROM rooms WHERE floor = 5 AND room_number = '01'), 2, 'RESIDENT'::user_role, TRUE),
    ('501-3@test', '$$hash5013', (SELECT id FROM rooms WHERE floor = 5 AND room_number = '01'), 3, 'RESIDENT'::user_role, TRUE),
    ('502-1@test', '$$hash5021', (SELECT id FROM rooms WHERE floor = 5 AND room_number = '02'), 1, 'RESIDENT'::user_role, TRUE),
    ('502-2@test', '$$hash5022', (SELECT id FROM rooms WHERE floor = 5 AND room_number = '02'), 2, 'RESIDENT'::user_role, TRUE),
    ('502-3@test', '$$hash5023', (SELECT id FROM rooms WHERE floor = 5 AND room_number = '02'), 3, 'RESIDENT'::user_role, TRUE),
    ('513-1@test', '$$hash5131', (SELECT id FROM rooms WHERE floor = 5 AND room_number = '13'), 1, 'RESIDENT'::user_role, TRUE),
    -- 층별장
    ('floor2lead@test', '$$hashlead2', (SELECT id FROM rooms WHERE floor = 2 AND room_number = '01'), 1, 'INSPECTOR'::user_role, TRUE),
    ('floor3lead@test', '$$hashlead3', (SELECT id FROM rooms WHERE floor = 3 AND room_number = '01'), 1, 'INSPECTOR'::user_role, TRUE),
    ('floor4lead@test', '$$hashlead4', (SELECT id FROM rooms WHERE floor = 4 AND room_number = '01'), 1, 'INSPECTOR'::user_role, TRUE),
    ('floor5lead@test', '$$hashlead5', (SELECT id FROM rooms WHERE floor = 5 AND room_number = '01'), 1, 'INSPECTOR'::user_role, TRUE)
ON CONFLICT (email) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    room_id       = EXCLUDED.room_id,
    personal_no   = EXCLUDED.personal_no,
    role          = EXCLUDED.role,
    is_active     = EXCLUDED.is_active;

-- ============
-- 냉장고/칸/배분 시드 및 샘플 데이터
-- ============
DO $$
DECLARE
    v_user_admin    BIGINT;
    v_user_201      BIGINT;
    v_user_202      BIGINT;
    v_user_213      BIGINT;
    v_user_301      BIGINT;
    v_user_302      BIGINT;
    v_user_313      BIGINT;
    v_user_401      BIGINT;
    v_user_402      BIGINT;
    v_user_413      BIGINT;
    v_user_501      BIGINT;
    v_user_502      BIGINT;
    v_user_513      BIGINT;
    v_lead2         BIGINT;
    v_lead3         BIGINT;
    v_lead4         BIGINT;
    v_lead5         BIGINT;
    floor_row RECORD;
    unit_id BIGINT;
    comp1 BIGINT;
    comp2 BIGINT;
    comp3 BIGINT;
    comp4 BIGINT;
    comp BIGINT;
    v_unit2 BIGINT;
    v_unit3 BIGINT;
    v_unit4 BIGINT;
    v_unit5 BIGINT;
    v_comp2_1 BIGINT;
    v_comp2_2 BIGINT;
    v_comp2_3 BIGINT;
    v_comp2_4 BIGINT;
    v_comp3_1 BIGINT;
    v_comp3_2 BIGINT;
    v_comp3_3 BIGINT;
    v_comp3_4 BIGINT;
    v_comp4_1 BIGINT;
    v_comp4_2 BIGINT;
    v_comp4_3 BIGINT;
    v_comp4_4 BIGINT;
    v_comp5_1 BIGINT;
    v_comp5_2 BIGINT;
    v_comp5_3 BIGINT;
    v_comp5_4 BIGINT;
    v_label INTEGER;
    v_bundle BIGINT;
    v_bundle2_main BIGINT;
    v_bundle2_snack BIGINT;
    v_bundle2_freezer BIGINT;
    v_bundle3_main BIGINT;
    v_bundle4_main BIGINT;
    v_bundle5_main BIGINT;
    v_session2 BIGINT;
    v_session3 BIGINT;
BEGIN
    -- resolve frequently used user ids
    SELECT id INTO v_user_admin FROM users WHERE email = 'a@dm.test';
    SELECT id INTO v_user_201 FROM users WHERE email = '201-1@test';
    SELECT id INTO v_user_202 FROM users WHERE email = '202-1@test';
    SELECT id INTO v_user_213 FROM users WHERE email = '213-1@test';
    SELECT id INTO v_user_301 FROM users WHERE email = '301-1@test';
    SELECT id INTO v_user_302 FROM users WHERE email = '302-1@test';
    SELECT id INTO v_user_313 FROM users WHERE email = '313-1@test';
    SELECT id INTO v_user_401 FROM users WHERE email = '401-1@test';
    SELECT id INTO v_user_402 FROM users WHERE email = '402-1@test';
    SELECT id INTO v_user_413 FROM users WHERE email = '413-1@test';
    SELECT id INTO v_user_501 FROM users WHERE email = '501-1@test';
    SELECT id INTO v_user_502 FROM users WHERE email = '502-1@test';
    SELECT id INTO v_user_513 FROM users WHERE email = '513-1@test';
    SELECT id INTO v_lead2 FROM users WHERE email = 'floor2lead@test';
    SELECT id INTO v_lead3 FROM users WHERE email = 'floor3lead@test';
    SELECT id INTO v_lead4 FROM users WHERE email = 'floor4lead@test';
    SELECT id INTO v_lead5 FROM users WHERE email = 'floor5lead@test';

    -- 층별 냉장고/칸/라벨/배분 초기화
    FOR floor_row IN SELECT * FROM (VALUES (2,'A'), (3,'B'), (4,'C'), (5,'D')) AS f(floor, building) LOOP
        INSERT INTO fridge_units (floor, unit_no, building)
        VALUES (floor_row.floor, 1, floor_row.building)
        ON CONFLICT (floor, unit_no) DO UPDATE
        SET building = EXCLUDED.building
        RETURNING id INTO unit_id;

        INSERT INTO compartments (unit_id, display_order, type, label_range_start, label_range_end)
        VALUES (unit_id, 1, 'FRIDGE'::compartment_type, 1, 999)
        ON CONFLICT (unit_id, display_order) DO UPDATE
        SET type = EXCLUDED.type,
            label_range_start = EXCLUDED.label_range_start,
            label_range_end   = EXCLUDED.label_range_end
        RETURNING id INTO comp1;

        INSERT INTO compartments (unit_id, display_order, type, label_range_start, label_range_end)
        VALUES (unit_id, 2, 'FRIDGE'::compartment_type, 1, 999)
        ON CONFLICT (unit_id, display_order) DO UPDATE
        SET type = EXCLUDED.type,
            label_range_start = EXCLUDED.label_range_start,
            label_range_end   = EXCLUDED.label_range_end
        RETURNING id INTO comp2;

        INSERT INTO compartments (unit_id, display_order, type, label_range_start, label_range_end)
        VALUES (unit_id, 3, 'FRIDGE'::compartment_type, 1, 999)
        ON CONFLICT (unit_id, display_order) DO UPDATE
        SET type = EXCLUDED.type,
            label_range_start = EXCLUDED.label_range_start,
            label_range_end   = EXCLUDED.label_range_end
        RETURNING id INTO comp3;

        INSERT INTO compartments (unit_id, display_order, type, label_range_start, label_range_end)
        VALUES (unit_id, 4, 'FREEZER'::compartment_type, 1, 999)
        ON CONFLICT (unit_id, display_order) DO UPDATE
        SET type = EXCLUDED.type,
            label_range_start = EXCLUDED.label_range_start,
            label_range_end   = EXCLUDED.label_range_end
        RETURNING id INTO comp4;

        IF floor_row.floor = 2 THEN
            v_unit2 := unit_id;
            v_comp2_1 := comp1;
            v_comp2_2 := comp2;
            v_comp2_3 := comp3;
            v_comp2_4 := comp4;
        ELSIF floor_row.floor = 3 THEN
            v_unit3 := unit_id;
            v_comp3_1 := comp1;
            v_comp3_2 := comp2;
            v_comp3_3 := comp3;
            v_comp3_4 := comp4;
        ELSIF floor_row.floor = 4 THEN
            v_unit4 := unit_id;
            v_comp4_1 := comp1;
            v_comp4_2 := comp2;
            v_comp4_3 := comp3;
            v_comp4_4 := comp4;
        ELSE
            v_unit5 := unit_id;
            v_comp5_1 := comp1;
            v_comp5_2 := comp2;
            v_comp5_3 := comp3;
            v_comp5_4 := comp4;
        END IF;

        -- 칸 배분 규칙
        INSERT INTO compartment_room_access (compartment_id, room_id, allocation_rule, active_from, active_to)
        SELECT comp1, r.id, 'DIRECT', DATE '2025-10-01', NULL
        FROM rooms r
        WHERE r.floor = floor_row.floor
          AND r.room_number::int BETWEEN 1 AND 8
          AND NOT EXISTS (
            SELECT 1 FROM compartment_room_access cra
            WHERE cra.compartment_id = comp1
              AND cra.room_id = r.id
              AND cra.active_to IS NULL
          );

        INSERT INTO compartment_room_access (compartment_id, room_id, allocation_rule, active_from, active_to)
        SELECT comp2, r.id, 'DIRECT', DATE '2025-10-01', NULL
        FROM rooms r
        WHERE r.floor = floor_row.floor
          AND r.room_number::int BETWEEN 9 AND 16
          AND NOT EXISTS (
            SELECT 1 FROM compartment_room_access cra
            WHERE cra.compartment_id = comp2
              AND cra.room_id = r.id
              AND cra.active_to IS NULL
          );

        INSERT INTO compartment_room_access (compartment_id, room_id, allocation_rule, active_from, active_to)
        SELECT comp3, r.id, 'DIRECT', DATE '2025-10-01', NULL
        FROM rooms r
        WHERE r.floor = floor_row.floor
          AND r.room_number::int BETWEEN 17 AND 24
          AND NOT EXISTS (
            SELECT 1 FROM compartment_room_access cra
            WHERE cra.compartment_id = comp3
              AND cra.room_id = r.id
              AND cra.active_to IS NULL
          );

        INSERT INTO compartment_room_access (compartment_id, room_id, allocation_rule, active_from, active_to)
        SELECT comp4, r.id, 'DIRECT', DATE '2025-10-01', NULL
        FROM rooms r
        WHERE r.floor = floor_row.floor
          AND NOT EXISTS (
            SELECT 1 FROM compartment_room_access cra
            WHERE cra.compartment_id = comp4
              AND cra.room_id = r.id
              AND cra.active_to IS NULL
          );

        FOREACH comp IN ARRAY ARRAY[comp1, comp2, comp3, comp4] LOOP
            INSERT INTO label_pool (compartment_id, label_number, status)
            SELECT comp, gs, 0
            FROM generate_series(1, 999) AS gs
            ON CONFLICT (compartment_id, label_number) DO NOTHING;
        END LOOP;
    END LOOP;

    -- 2층 샘플 데이터 (거주자 201, 202, 213)
    IF v_user_201 IS NOT NULL AND v_comp2_1 IS NOT NULL THEN
        SELECT label_number INTO v_label
        FROM label_pool
        WHERE compartment_id = v_comp2_1 AND status = 0
        ORDER BY label_number
        LIMIT 1
        FOR UPDATE;

        IF v_label IS NULL THEN
            RAISE EXCEPTION '층 2의 라벨을 찾을 수 없습니다.';
        END IF;

        UPDATE label_pool
        SET status = 1,
            last_used_at = CURRENT_TIMESTAMP
        WHERE compartment_id = v_comp2_1
          AND label_number = v_label;

        INSERT INTO fridge_bundles (owner_id, compartment_id, label_number, bundle_name, status_code)
        VALUES (v_user_201, v_comp2_1, v_label, '아침 식재료', 'NORMAL')
        ON CONFLICT (compartment_id, label_number) DO UPDATE
        SET owner_id = EXCLUDED.owner_id,
            bundle_name = EXCLUDED.bundle_name,
            status_code = EXCLUDED.status_code
        RETURNING id INTO v_bundle2_main;

        UPDATE label_pool
        SET last_used_bundle_id = v_bundle2_main
        WHERE compartment_id = v_comp2_1
          AND label_number = v_label;

        INSERT INTO fridge_items (bundle_id, item_name, expiry_date, state_code, memo)
        SELECT v_bundle2_main, '계란', CURRENT_DATE + INTERVAL '3 day', 'IMMINENT', NULL
        WHERE NOT EXISTS (SELECT 1 FROM fridge_items WHERE bundle_id = v_bundle2_main AND item_name = '계란');

        INSERT INTO fridge_items (bundle_id, item_name, expiry_date, state_code, memo)
        SELECT v_bundle2_main, '우유', CURRENT_DATE + INTERVAL '1 day', 'IMMINENT', NULL
        WHERE NOT EXISTS (SELECT 1 FROM fridge_items WHERE bundle_id = v_bundle2_main AND item_name = '우유');
    END IF;

    IF v_user_202 IS NOT NULL AND v_comp2_2 IS NOT NULL THEN
        SELECT label_number INTO v_label
        FROM label_pool
        WHERE compartment_id = v_comp2_2 AND status = 0
        ORDER BY label_number
        LIMIT 1
        FOR UPDATE;

        IF v_label IS NULL THEN
            RAISE EXCEPTION '층 2의 라벨을 찾을 수 없습니다.(comp2_2)';
        END IF;

        UPDATE label_pool
        SET status = 1,
            last_used_at = CURRENT_TIMESTAMP
        WHERE compartment_id = v_comp2_2
          AND label_number = v_label;

        INSERT INTO fridge_bundles (owner_id, compartment_id, label_number, bundle_name, status_code)
        VALUES (v_user_202, v_comp2_2, v_label, '야식 식재료', 'NORMAL')
        ON CONFLICT (compartment_id, label_number) DO UPDATE
        SET owner_id = EXCLUDED.owner_id,
            bundle_name = EXCLUDED.bundle_name,
            status_code = EXCLUDED.status_code
        RETURNING id INTO v_bundle2_snack;

        UPDATE label_pool
        SET last_used_bundle_id = v_bundle2_snack
        WHERE compartment_id = v_comp2_2
          AND label_number = v_label;

        INSERT INTO fridge_items (bundle_id, item_name, expiry_date, state_code, memo)
        SELECT v_bundle2_snack, '컵라면', CURRENT_DATE + INTERVAL '5 day', 'NORMAL', '야식용 간편식'
        WHERE NOT EXISTS (SELECT 1 FROM fridge_items WHERE bundle_id = v_bundle2_snack AND item_name = '컵라면');

        INSERT INTO fridge_items (bundle_id, item_name, expiry_date, state_code, memo)
        SELECT v_bundle2_snack, '치즈볼', CURRENT_DATE + INTERVAL '1 day', 'IMMINENT', '오늘 안에 소진 권장'
        WHERE NOT EXISTS (SELECT 1 FROM fridge_items WHERE bundle_id = v_bundle2_snack AND item_name = '치즈볼');

        INSERT INTO fridge_items (bundle_id, item_name, expiry_date, state_code, memo)
        SELECT v_bundle2_snack, '콜라 500ml', CURRENT_DATE - INTERVAL '1 day', 'EXPIRED', '상미기한 경과'
        WHERE NOT EXISTS (SELECT 1 FROM fridge_items WHERE bundle_id = v_bundle2_snack AND item_name = '콜라 500ml');
    END IF;

    IF v_user_213 IS NOT NULL AND v_comp2_4 IS NOT NULL THEN
        SELECT label_number INTO v_label
        FROM label_pool
        WHERE compartment_id = v_comp2_4 AND status = 0
        ORDER BY label_number
        LIMIT 1
        FOR UPDATE;

        IF v_label IS NULL THEN
            RAISE EXCEPTION '층 2의 냉동 라벨을 찾을 수 없습니다.';
        END IF;

        UPDATE label_pool
        SET status = 1,
            last_used_at = CURRENT_TIMESTAMP
        WHERE compartment_id = v_comp2_4
          AND label_number = v_label;

        INSERT INTO fridge_bundles (owner_id, compartment_id, label_number, bundle_name, status_code)
        VALUES (v_user_213, v_comp2_4, v_label, '장기 보관 냉동식품', 'DISPOSED')
        ON CONFLICT (compartment_id, label_number) DO UPDATE
        SET owner_id = EXCLUDED.owner_id,
            bundle_name = EXCLUDED.bundle_name,
            status_code = EXCLUDED.status_code
        RETURNING id INTO v_bundle2_freezer;

        UPDATE label_pool
        SET last_used_bundle_id = v_bundle2_freezer
        WHERE compartment_id = v_comp2_4
          AND label_number = v_label;

        INSERT INTO fridge_items (bundle_id, item_name, expiry_date, state_code, memo)
        SELECT v_bundle2_freezer, '냉동만두', CURRENT_DATE - INTERVAL '5 day', 'DISPOSED', '폐기 처리 완료'
        WHERE NOT EXISTS (SELECT 1 FROM fridge_items WHERE bundle_id = v_bundle2_freezer AND item_name = '냉동만두');

        INSERT INTO fridge_items (bundle_id, item_name, expiry_date, state_code, memo)
        SELECT v_bundle2_freezer, '아이스크림 팩', CURRENT_DATE - INTERVAL '2 day', 'DISPOSED', '검사 중 폐기됨'
        WHERE NOT EXISTS (SELECT 1 FROM fridge_items WHERE bundle_id = v_bundle2_freezer AND item_name = '아이스크림 팩');
    END IF;

    -- 2층 검사 세션 예시
    IF v_comp2_1 IS NOT NULL THEN
        INSERT INTO inspection_sessions (compartment_id, session_uuid, status, started_at, ended_at)
        VALUES (v_comp2_1, '11111111-1111-1111-1111-111111111111', 'OPEN', CURRENT_TIMESTAMP - INTERVAL '1 hour', NULL)
        ON CONFLICT (session_uuid) DO UPDATE
        SET compartment_id = EXCLUDED.compartment_id,
            status         = EXCLUDED.status,
            started_at     = EXCLUDED.started_at,
            ended_at       = EXCLUDED.ended_at;

        IF v_lead2 IS NOT NULL THEN
            INSERT INTO inspection_inspectors (session_id, inspector_id)
            VALUES (
                (SELECT id FROM inspection_sessions WHERE session_uuid = '11111111-1111-1111-1111-111111111111'),
                v_lead2
            )
            ON CONFLICT (session_id, inspector_id) DO NOTHING;
        END IF;
    END IF;

    IF v_comp2_2 IS NOT NULL AND v_lead2 IS NOT NULL AND v_bundle2_snack IS NOT NULL THEN
        INSERT INTO inspection_sessions (compartment_id, session_uuid, status, started_at, ended_at)
        VALUES (v_comp2_2, '22222222-2222-2222-2222-222222222222', 'SUBMITTED', CURRENT_TIMESTAMP - INTERVAL '12 hour', CURRENT_TIMESTAMP - INTERVAL '11 hour')
        ON CONFLICT (session_uuid) DO UPDATE
        SET compartment_id = EXCLUDED.compartment_id,
            status         = EXCLUDED.status,
            started_at     = EXCLUDED.started_at,
            ended_at       = EXCLUDED.ended_at;

        SELECT id INTO v_session2 FROM inspection_sessions WHERE session_uuid = '22222222-2222-2222-2222-222222222222';

        INSERT INTO inspection_inspectors (session_id, inspector_id)
        VALUES (v_session2, v_lead2)
        ON CONFLICT (session_id, inspector_id) DO NOTHING;

        IF NOT EXISTS (
            SELECT 1 FROM inspection_actions
            WHERE session_id = v_session2
              AND inspector_id = v_lead2
              AND bundle_id = v_bundle2_snack
              AND action_type_code = 'PASS'
        ) THEN
            INSERT INTO inspection_actions (session_id, inspector_id, bundle_id, action_type_code, memo)
            VALUES (v_session2, v_lead2, v_bundle2_snack, 'PASS', '정상 보관 확인');
        END IF;
    END IF;

    IF v_comp2_4 IS NOT NULL AND v_lead2 IS NOT NULL AND v_bundle2_freezer IS NOT NULL THEN
        INSERT INTO inspection_sessions (compartment_id, session_uuid, status, started_at, ended_at)
        VALUES (v_comp2_4, '33333333-3333-3333-3333-333333333333', 'SUBMITTED', CURRENT_TIMESTAMP - INTERVAL '6 hour', CURRENT_TIMESTAMP - INTERVAL '5 hour')
        ON CONFLICT (session_uuid) DO UPDATE
        SET compartment_id = EXCLUDED.compartment_id,
            status         = EXCLUDED.status,
            started_at     = EXCLUDED.started_at,
            ended_at       = EXCLUDED.ended_at;

        SELECT id INTO v_session3 FROM inspection_sessions WHERE session_uuid = '33333333-3333-3333-3333-333333333333';

        INSERT INTO inspection_inspectors (session_id, inspector_id)
        VALUES (v_session3, v_lead2)
        ON CONFLICT (session_id, inspector_id) DO NOTHING;

        IF NOT EXISTS (
            SELECT 1 FROM inspection_actions
            WHERE session_id = v_session3
              AND inspector_id = v_lead2
              AND bundle_id = v_bundle2_freezer
              AND action_type_code = 'DISPOSE'
        ) THEN
            INSERT INTO inspection_actions (session_id, inspector_id, bundle_id, action_type_code, reason_code, memo)
            VALUES (v_session3, v_lead2, v_bundle2_freezer, 'DISPOSE', 'STORAGE_ISSUE', '장기 방치로 폐기');
        END IF;
    END IF;

    -- 3~5층 간단 샘플 데이터
    IF v_user_301 IS NOT NULL AND v_comp3_1 IS NOT NULL THEN
        SELECT label_number INTO v_label
        FROM label_pool
        WHERE compartment_id = v_comp3_1 AND status = 0
        ORDER BY label_number
        LIMIT 1
        FOR UPDATE;

        IF v_label IS NOT NULL THEN
            UPDATE label_pool
            SET status = 1,
                last_used_at = CURRENT_TIMESTAMP
            WHERE compartment_id = v_comp3_1
              AND label_number = v_label;

            INSERT INTO fridge_bundles (owner_id, compartment_id, label_number, bundle_name, status_code)
            VALUES (v_user_301, v_comp3_1, v_label, '샐러드 준비', 'NORMAL')
            ON CONFLICT (compartment_id, label_number) DO UPDATE
            SET owner_id = EXCLUDED.owner_id,
                bundle_name = EXCLUDED.bundle_name,
                status_code = EXCLUDED.status_code
            RETURNING id INTO v_bundle3_main;

            UPDATE label_pool
            SET last_used_bundle_id = v_bundle3_main
            WHERE compartment_id = v_comp3_1
              AND label_number = v_label;

            INSERT INTO fridge_items (bundle_id, item_name, expiry_date, state_code, memo)
            SELECT v_bundle3_main, '양상추', CURRENT_DATE + INTERVAL '2 day', 'NORMAL', NULL
            WHERE NOT EXISTS (SELECT 1 FROM fridge_items WHERE bundle_id = v_bundle3_main AND item_name = '양상추');

            INSERT INTO fridge_items (bundle_id, item_name, expiry_date, state_code, memo)
            SELECT v_bundle3_main, '닭가슴살', CURRENT_DATE + INTERVAL '1 day', 'IMMINENT', '미리 해동된 상태'
            WHERE NOT EXISTS (SELECT 1 FROM fridge_items WHERE bundle_id = v_bundle3_main AND item_name = '닭가슴살');
        END IF;
    END IF;

    IF v_user_401 IS NOT NULL AND v_comp4_1 IS NOT NULL THEN
        SELECT label_number INTO v_label
        FROM label_pool
        WHERE compartment_id = v_comp4_1 AND status = 0
        ORDER BY label_number
        LIMIT 1
        FOR UPDATE;

        IF v_label IS NOT NULL THEN
            UPDATE label_pool
            SET status = 1,
                last_used_at = CURRENT_TIMESTAMP
            WHERE compartment_id = v_comp4_1
              AND label_number = v_label;

            INSERT INTO fridge_bundles (owner_id, compartment_id, label_number, bundle_name, status_code)
            VALUES (v_user_401, v_comp4_1, v_label, '야채 보관함', 'NORMAL')
            ON CONFLICT (compartment_id, label_number) DO UPDATE
            SET owner_id = EXCLUDED.owner_id,
                bundle_name = EXCLUDED.bundle_name,
                status_code = EXCLUDED.status_code
            RETURNING id INTO v_bundle4_main;

            UPDATE label_pool
            SET last_used_bundle_id = v_bundle4_main
            WHERE compartment_id = v_comp4_1
              AND label_number = v_label;

            INSERT INTO fridge_items (bundle_id, item_name, expiry_date, state_code, memo)
            SELECT v_bundle4_main, '방울토마토', CURRENT_DATE + INTERVAL '4 day', 'NORMAL', NULL
            WHERE NOT EXISTS (SELECT 1 FROM fridge_items WHERE bundle_id = v_bundle4_main AND item_name = '방울토마토');
        END IF;
    END IF;

    IF v_user_501 IS NOT NULL AND v_comp5_1 IS NOT NULL THEN
        SELECT label_number INTO v_label
        FROM label_pool
        WHERE compartment_id = v_comp5_1 AND status = 0
        ORDER BY label_number
        LIMIT 1
        FOR UPDATE;

        IF v_label IS NOT NULL THEN
            UPDATE label_pool
            SET status = 1,
                last_used_at = CURRENT_TIMESTAMP
            WHERE compartment_id = v_comp5_1
              AND label_number = v_label;

            INSERT INTO fridge_bundles (owner_id, compartment_id, label_number, bundle_name, status_code)
            VALUES (v_user_501, v_comp5_1, v_label, '디저트 보관함', 'NORMAL')
            ON CONFLICT (compartment_id, label_number) DO UPDATE
            SET owner_id = EXCLUDED.owner_id,
                bundle_name = EXCLUDED.bundle_name,
                status_code = EXCLUDED.status_code
            RETURNING id INTO v_bundle5_main;

            UPDATE label_pool
            SET last_used_bundle_id = v_bundle5_main
            WHERE compartment_id = v_comp5_1
              AND label_number = v_label;

            INSERT INTO fridge_items (bundle_id, item_name, expiry_date, state_code, memo)
            SELECT v_bundle5_main, '푸딩', CURRENT_DATE + INTERVAL '2 day', 'NORMAL', '디저트'
            WHERE NOT EXISTS (SELECT 1 FROM fridge_items WHERE bundle_id = v_bundle5_main AND item_name = '푸딩');
        END IF;
    END IF;

    -- 알림 샘플
    IF v_user_202 IS NOT NULL AND v_bundle2_snack IS NOT NULL AND v_session2 IS NOT NULL THEN
        INSERT INTO notifications (
            user_id, kind_code, title, preview_json, detail_json, dedupe_key,
            ttl_at, related_bundle_id
        )
        VALUES (
            v_user_202,
            'FRIDGE_EXPIRY',
            '야식 묶음 상태 알림',
            jsonb_build_object(
                'summary', '치즈볼 1개가 임박, 콜라 1개가 유통기한 경과했습니다.',
                'item_names', jsonb_build_array('치즈볼', '콜라 500ml'),
                'counts', jsonb_build_object('imminent', 1, 'expired', 1),
                'icon', 'warning'
            ),
            jsonb_build_object(
                'type', 'FRIDGE_EXPIRY',
                'bundle_id', v_bundle2_snack,
                'item_count', 3,
                'warning_count', 1,
                'dispose_count', 1,
                'items', jsonb_build_array(
                    jsonb_build_object('name', '컵라면', 'expiry_date', to_char(CURRENT_DATE + INTERVAL '5 day', 'YYYY-MM-DD'), 'state', 'NORMAL'),
                    jsonb_build_object('name', '치즈볼', 'expiry_date', to_char(CURRENT_DATE + INTERVAL '1 day', 'YYYY-MM-DD'), 'state', 'IMMINENT'),
                    jsonb_build_object('name', '콜라 500ml', 'expiry_date', to_char(CURRENT_DATE - INTERVAL '1 day', 'YYYY-MM-DD'), 'state', 'EXPIRED')
                )
            ),
            rpad('demo_dedupe_key_202_expiry', 64, 'e'),
            CURRENT_TIMESTAMP + INTERVAL '18 hour',
            v_bundle2_snack
        )
        ON CONFLICT (dedupe_key) DO UPDATE
        SET ttl_at           = EXCLUDED.ttl_at,
            preview_json     = EXCLUDED.preview_json,
            detail_json      = EXCLUDED.detail_json,
            related_bundle_id = EXCLUDED.related_bundle_id;

        INSERT INTO notifications (
            user_id, kind_code, title, preview_json, detail_json, dedupe_key,
            ttl_at, related_session_id
        )
        VALUES (
            v_user_202,
            'INSPECTION_RESULT',
            '정기 점검 결과 안내',
            jsonb_build_object('summary', '점검 결과: 통과 1건이 기록되었습니다.'),
            jsonb_build_object(
                'type', 'INSPECTION_RESULT',
                'session_id', v_session2,
                'affected_bundles', 1,
                'actions', jsonb_build_array(
                    jsonb_build_object('bundle_id', v_bundle2_snack, 'action', 'PASS')
                )
            ),
            rpad('demo_dedupe_key_inspection_202', 64, 'f'),
            CURRENT_TIMESTAMP + INTERVAL '72 hour',
            v_session2
        )
        ON CONFLICT (dedupe_key) DO UPDATE
        SET ttl_at             = EXCLUDED.ttl_at,
            preview_json       = EXCLUDED.preview_json,
            detail_json        = EXCLUDED.detail_json,
            related_session_id = EXCLUDED.related_session_id;
    END IF;

    IF v_user_213 IS NOT NULL AND v_bundle2_freezer IS NOT NULL AND v_session3 IS NOT NULL THEN
        INSERT INTO notifications (
            user_id, kind_code, title, preview_json, detail_json, dedupe_key,
            ttl_at, related_session_id
        )
        VALUES (
            v_user_213,
            'INSPECTION_RESULT',
            '냉동 칸 폐기 조치 알림',
            jsonb_build_object('summary', '장기 보관 냉동식품이 폐기 처리되었습니다.'),
            jsonb_build_object(
                'type', 'INSPECTION_RESULT',
                'session_id', v_session3,
                'affected_bundles', 1,
                'actions', jsonb_build_array(
                    jsonb_build_object('bundle_id', v_bundle2_freezer, 'action', 'DISPOSE', 'reason', 'STORAGE_ISSUE')
                )
            ),
            rpad('demo_dedupe_key_inspection_213_dispose', 64, 'g'),
            CURRENT_TIMESTAMP + INTERVAL '72 hour',
            v_session3
        )
        ON CONFLICT (dedupe_key) DO UPDATE
        SET ttl_at             = EXCLUDED.ttl_at,
            preview_json       = EXCLUDED.preview_json,
            detail_json        = EXCLUDED.detail_json,
            related_session_id = EXCLUDED.related_session_id;
    END IF;

    IF v_user_201 IS NOT NULL AND v_bundle2_main IS NOT NULL THEN
        INSERT INTO notifications (
            user_id, kind_code, title, preview_json, detail_json, dedupe_key,
            ttl_at, related_bundle_id
        )
        VALUES (
            v_user_201,
            'FRIDGE_EXPIRY',
            '유통기한 임박 알림',
            jsonb_build_object(
                'summary', '계란 외 1개 물품의 유통기한이 임박했습니다.',
                'item_names', jsonb_build_array('계란', '우유'),
                'counts', jsonb_build_object('imminent', 2, 'expired', 0),
                'icon', 'expiry_warning'
            ),
            jsonb_build_object(
                'type', 'FRIDGE_EXPIRY',
                'bundle_id', v_bundle2_main,
                'item_count', 2,
                'warning_count', 1,
                'dispose_count', 0,
                'items', jsonb_build_array(
                    jsonb_build_object('name', '계란', 'expiry_date', to_char(CURRENT_DATE + INTERVAL '3 day', 'YYYY-MM-DD'), 'state', 'IMMINENT'),
                    jsonb_build_object('name', '우유', 'expiry_date', to_char(CURRENT_DATE + INTERVAL '1 day', 'YYYY-MM-DD'), 'state', 'IMMINENT')
                )
            ),
            rpad('demo_dedupe_key_201_2025_10_12_bundle_1', 64, 'x'),
            CURRENT_TIMESTAMP + INTERVAL '24 hour',
            v_bundle2_main
        )
        ON CONFLICT (dedupe_key) DO UPDATE
        SET ttl_at           = EXCLUDED.ttl_at,
            preview_json     = EXCLUDED.preview_json,
            detail_json      = EXCLUDED.detail_json,
            related_bundle_id = EXCLUDED.related_bundle_id;
    END IF;

    IF v_user_201 IS NOT NULL THEN
        INSERT INTO notifications (
            user_id, kind_code, title, preview_json, detail_json, dedupe_key, ttl_at
        )
        VALUES (
            v_user_201,
            'ROOM_START',
            '입사 안내',
            jsonb_build_object(
                'summary', '환영합니다. 생활 안내를 확인하세요.',
                'icon', 'info'
            ),
            jsonb_build_object(
                'type', 'ROOM_START',
                'links', jsonb_build_array(
                    jsonb_build_object('title', '생활 수칙', 'url', '/guide/rules'),
                    jsonb_build_object('title', '층별 담당', 'url', '/guide/staff')
                )
            ),
            rpad('demo_dedupe_key_room_start_201', 64, 'z'),
            CURRENT_TIMESTAMP + INTERVAL '24 hour'
        )
        ON CONFLICT (dedupe_key) DO UPDATE
        SET ttl_at       = EXCLUDED.ttl_at,
            preview_json = EXCLUDED.preview_json,
            detail_json  = EXCLUDED.detail_json;
    END IF;

    IF v_user_admin IS NOT NULL AND v_lead2 IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM audit_logs
            WHERE actor_id = v_user_admin
              AND ref_id   = v_lead2
              AND action   = 'GRANT_INSPECTOR_ROLE'
        ) THEN
            INSERT INTO audit_logs (actor_id, actor_role_at_action, scope, ref_type, ref_id, action, after_json)
            VALUES (
                v_user_admin,
                'ADMIN',
                'USER',
                'User',
                v_lead2,
                'GRANT_INSPECTOR_ROLE',
                jsonb_build_object('previous_role', 'RESIDENT', 'new_role', 'INSPECTOR')
            );
        END IF;
    END IF;
END;
$$;
