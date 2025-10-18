-- =========================
-- DormMate 기본 시드 (PostgreSQL 전용)
-- 목적: 코드 테이블, 샘플 계정/냉장고 데이터/알림 초기화
-- 정책: 재실행 시 안전하도록 ON CONFLICT 활용
-- =========================

SET TIME ZONE 'UTC';

-- ============
-- 코드 테이블
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
    ('FRIDGE_EXPIRY',  'FRIDGE', 3, 24, '임박: {{bundle}} {{count}}건'),
    ('FRIDGE_RESULT',  'FRIDGE', 4, 72, '검사 결과 요약'),
    ('ROOM_PENALTY',   'ROOM',   2, 24, '벌점 {{points}}점 부과'),
    ('SYSTEM_NOTICE',  'SYSTEM', 1, 24, '시스템 알림')
ON CONFLICT (code) DO UPDATE
SET module    = EXCLUDED.module,
    severity  = EXCLUDED.severity,
    ttl_hours = EXCLUDED.ttl_hours,
    template  = EXCLUDED.template;

-- ============
-- 기본 공간(rooms)
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
-- 샘플 사용자
-- ============
INSERT INTO users (login_id, email, password_hash, room_id, personal_no, role, is_active, access_restricted)
VALUES
    ('admin',          'admin@dm.test', 'hashed-admin', NULL, NULL, 'ADMIN'::user_role, TRUE, FALSE),
    ('201-1', '201-1@test', 'hashed-2011', (SELECT id FROM rooms WHERE floor = 2 AND room_number = '01'), 1, 'RESIDENT'::user_role, TRUE, FALSE),
    ('201-2', '201-2@test', 'hashed-2012', (SELECT id FROM rooms WHERE floor = 2 AND room_number = '01'), 2, 'RESIDENT'::user_role, TRUE, FALSE),
    ('201-3', '201-3@test', 'hashed-2013', (SELECT id FROM rooms WHERE floor = 2 AND room_number = '01'), 3, 'RESIDENT'::user_role, TRUE, FALSE),
    ('202-1', '202-1@test', 'hashed-2021', (SELECT id FROM rooms WHERE floor = 2 AND room_number = '02'), 1, 'RESIDENT'::user_role, TRUE, FALSE),
    ('202-2', '202-2@test', 'hashed-2022', (SELECT id FROM rooms WHERE floor = 2 AND room_number = '02'), 2, 'RESIDENT'::user_role, TRUE, FALSE),
    ('202-3', '202-3@test', 'hashed-2023', (SELECT id FROM rooms WHERE floor = 2 AND room_number = '02'), 3, 'RESIDENT'::user_role, TRUE, FALSE),
    ('213-1', '213-1@test', 'hashed-2131', (SELECT id FROM rooms WHERE floor = 2 AND room_number = '13'), 1, 'RESIDENT'::user_role, TRUE, FALSE),
    ('224-1', '224-1@test', 'hashed-2241', (SELECT id FROM rooms WHERE floor = 2 AND room_number = '24'), 1, 'RESIDENT'::user_role, TRUE, FALSE),
    ('301-1', '301-1@test', 'hashed-3011', (SELECT id FROM rooms WHERE floor = 3 AND room_number = '01'), 1, 'RESIDENT'::user_role, TRUE, FALSE),
    ('301-2', '301-2@test', 'hashed-3012', (SELECT id FROM rooms WHERE floor = 3 AND room_number = '01'), 2, 'RESIDENT'::user_role, TRUE, FALSE),
    ('301-3', '301-3@test', 'hashed-3013', (SELECT id FROM rooms WHERE floor = 3 AND room_number = '01'), 3, 'RESIDENT'::user_role, TRUE, FALSE),
    ('302-1', '302-1@test', 'hashed-3021', (SELECT id FROM rooms WHERE floor = 3 AND room_number = '02'), 1, 'RESIDENT'::user_role, TRUE, FALSE),
    ('302-2', '302-2@test', 'hashed-3022', (SELECT id FROM rooms WHERE floor = 3 AND room_number = '02'), 2, 'RESIDENT'::user_role, TRUE, FALSE),
    ('302-3', '302-3@test', 'hashed-3023', (SELECT id FROM rooms WHERE floor = 3 AND room_number = '02'), 3, 'RESIDENT'::user_role, TRUE, FALSE),
    ('313-1', '313-1@test', 'hashed-3131', (SELECT id FROM rooms WHERE floor = 3 AND room_number = '13'), 1, 'RESIDENT'::user_role, TRUE, FALSE),
    ('401-1', '401-1@test', 'hashed-4011', (SELECT id FROM rooms WHERE floor = 4 AND room_number = '01'), 1, 'RESIDENT'::user_role, TRUE, FALSE),
    ('401-2', '401-2@test', 'hashed-4012', (SELECT id FROM rooms WHERE floor = 4 AND room_number = '01'), 2, 'RESIDENT'::user_role, TRUE, FALSE),
    ('401-3', '401-3@test', 'hashed-4013', (SELECT id FROM rooms WHERE floor = 4 AND room_number = '01'), 3, 'RESIDENT'::user_role, TRUE, FALSE),
    ('402-1', '402-1@test', 'hashed-4021', (SELECT id FROM rooms WHERE floor = 4 AND room_number = '02'), 1, 'RESIDENT'::user_role, TRUE, FALSE),
    ('402-2', '402-2@test', 'hashed-4022', (SELECT id FROM rooms WHERE floor = 4 AND room_number = '02'), 2, 'RESIDENT'::user_role, TRUE, FALSE),
    ('402-3', '402-3@test', 'hashed-4023', (SELECT id FROM rooms WHERE floor = 4 AND room_number = '02'), 3, 'RESIDENT'::user_role, TRUE, FALSE),
    ('413-1', '413-1@test', 'hashed-4131', (SELECT id FROM rooms WHERE floor = 4 AND room_number = '13'), 1, 'RESIDENT'::user_role, TRUE, FALSE),
    ('501-1', '501-1@test', 'hashed-5011', (SELECT id FROM rooms WHERE floor = 5 AND room_number = '01'), 1, 'RESIDENT'::user_role, TRUE, FALSE),
    ('501-2', '501-2@test', 'hashed-5012', (SELECT id FROM rooms WHERE floor = 5 AND room_number = '01'), 2, 'RESIDENT'::user_role, TRUE, FALSE),
    ('501-3', '501-3@test', 'hashed-5013', (SELECT id FROM rooms WHERE floor = 5 AND room_number = '01'), 3, 'RESIDENT'::user_role, TRUE, FALSE),
    ('502-1', '502-1@test', 'hashed-5021', (SELECT id FROM rooms WHERE floor = 5 AND room_number = '02'), 1, 'RESIDENT'::user_role, TRUE, FALSE),
    ('502-2', '502-2@test', 'hashed-5022', (SELECT id FROM rooms WHERE floor = 5 AND room_number = '02'), 2, 'RESIDENT'::user_role, TRUE, FALSE),
    ('502-3', '502-3@test', 'hashed-5023', (SELECT id FROM rooms WHERE floor = 5 AND room_number = '02'), 3, 'RESIDENT'::user_role, TRUE, FALSE),
    ('513-1', '513-1@test', 'hashed-5131', (SELECT id FROM rooms WHERE floor = 5 AND room_number = '13'), 1, 'RESIDENT'::user_role, TRUE, FALSE),
    ('lead-2', 'lead2@test', 'hashed-lead2', NULL, NULL, 'INSPECTOR'::user_role, TRUE, FALSE),
    ('lead-3', 'lead3@test', 'hashed-lead3', NULL, NULL, 'INSPECTOR'::user_role, TRUE, FALSE),
    ('lead-4', 'lead4@test', 'hashed-lead4', NULL, NULL, 'INSPECTOR'::user_role, TRUE, FALSE),
    ('lead-5', 'lead5@test', 'hashed-lead5', NULL, NULL, 'INSPECTOR'::user_role, TRUE, FALSE)
ON CONFLICT (login_id) DO UPDATE
SET email             = EXCLUDED.email,
    password_hash     = EXCLUDED.password_hash,
    room_id           = EXCLUDED.room_id,
    personal_no       = EXCLUDED.personal_no,
    role              = EXCLUDED.role,
    is_active         = EXCLUDED.is_active,
    access_restricted = EXCLUDED.access_restricted;

-- ============
-- 냉장고/칸/배분 시드
-- ============
DO $$
DECLARE
    v_floor INTEGER;
    v_unit  BIGINT;
    v_comp  BIGINT;
    v_room_offset INTEGER;
    idx INTEGER;
    comp_ids BIGINT[] := ARRAY[]::BIGINT[];
    v_type compartment_type;
    v_start INTEGER;
    v_end INTEGER;
BEGIN
    FOR v_floor IN 2..5 LOOP
        INSERT INTO fridge_units (building, floor, unit_no)
        VALUES ('A', v_floor, 1)
        ON CONFLICT (floor, unit_no) DO UPDATE SET building = EXCLUDED.building
        RETURNING id INTO v_unit;

        comp_ids := ARRAY[]::BIGINT[];
        FOR idx IN 1..4 LOOP
            IF idx < 4 THEN
                v_type := 'FRIDGE';
                v_start := v_floor * 1000 + (idx - 1) * 250 + 1;
                v_end   := v_start + 249;
            ELSE
                v_type := 'FREEZER';
                v_start := v_floor * 1000 + 900;
                v_end   := v_floor * 1000 + 999;
            END IF;

            INSERT INTO compartments (unit_id, display_order, type, label_range_start, label_range_end)
            VALUES (v_unit, idx, v_type, v_start, v_end)
            ON CONFLICT (unit_id, display_order)
            DO UPDATE SET type = EXCLUDED.type,
                          label_range_start = EXCLUDED.label_range_start,
                          label_range_end   = EXCLUDED.label_range_end
            RETURNING id INTO v_comp;

            comp_ids := comp_ids || v_comp;
        END LOOP;

        -- 기본 배정 (FRIDGE 1~3)
        FOR idx IN 1..3 LOOP
            IF NOT EXISTS (
                SELECT 1 FROM compartment_room_access
                 WHERE compartment_id = comp_ids[idx]
            ) THEN
                v_room_offset := (idx - 1) * 8;
                INSERT INTO compartment_room_access (compartment_id, room_id, allocation_rule, active_from, active_to)
                SELECT comp_ids[idx],
                       r.id,
                       'AUTO',
                       CURRENT_DATE,
                       NULL
                  FROM (
                        SELECT id, row_number() OVER () - 1 AS rn
                          FROM rooms
                         WHERE floor = v_floor
                         ORDER BY room_number
                       ) r
                 WHERE r.rn BETWEEN v_room_offset AND v_room_offset + 7;
            END IF;
        END LOOP;

        IF NOT EXISTS (
            SELECT 1 FROM compartment_room_access
             WHERE compartment_id = comp_ids[4]
        ) THEN
            INSERT INTO compartment_room_access (compartment_id, room_id, allocation_rule, active_from, active_to)
            SELECT comp_ids[4], r.id, 'FREEZER', CURRENT_DATE, NULL
              FROM rooms r
             WHERE r.floor = v_floor;
        END IF;
    END LOOP;
END;
$$;

-- ============
-- 샘플 포장/알림
-- ============
DO $$
DECLARE
    v_owner BIGINT;
    v_comp  BIGINT;
    v_bundle BIGINT;
    v_label  INTEGER;
BEGIN
    SELECT id INTO v_owner FROM users WHERE login_id = '201-1';
    SELECT c.id INTO v_comp
      FROM compartments c
      JOIN fridge_units u ON u.id = c.unit_id
     WHERE u.floor = 2 AND c.display_order = 1;

    IF v_owner IS NOT NULL AND v_comp IS NOT NULL THEN
        SELECT label_range_start INTO v_label FROM compartments WHERE id = v_comp;

        INSERT INTO fridge_bundles (owner_id, compartment_id, label_number, bundle_name, status_code)
        VALUES (v_owner, v_comp, COALESCE(v_label, 1), '주간 식재료', 'NORMAL')
        ON CONFLICT (compartment_id, label_number) DO UPDATE
        SET owner_id = EXCLUDED.owner_id,
            bundle_name = EXCLUDED.bundle_name,
            status_code = EXCLUDED.status_code
        RETURNING id INTO v_bundle;

        IF v_bundle IS NOT NULL THEN
            INSERT INTO fridge_items (bundle_id, item_name, expiry_date, state_code, memo)
            VALUES
                (v_bundle, '계란', (CURRENT_DATE + INTERVAL '5 day')::date, 'NORMAL', '유통기한 체크'),
                (v_bundle, '두부', (CURRENT_DATE + INTERVAL '2 day')::date, 'IMMINENT', NULL)
            ON CONFLICT DO NOTHING;

            INSERT INTO notifications (user_id, kind_code, title, preview_json, detail_json, related_bundle_id, dedupe_key, is_read)
            VALUES (
                v_owner,
                'FRIDGE_EXPIRY',
                '냉장고 임박 알림',
                jsonb_build_object('summary', '계란 외 1개가 임박했습니다.'),
                jsonb_build_object('items', jsonb_build_array('계란', '두부')),
                v_bundle,
                md5('sample-expiry-' || v_owner),
                FALSE
            )
            ON CONFLICT (dedupe_key) DO NOTHING;
        END IF;
    END IF;
END;
$$;
