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
-- 기본 공간 및 사용자
-- ============
INSERT INTO rooms (floor, room_number, capacity, type)
VALUES
    (2, '01', 3, 'TRIPLE'::room_type),
    (2, '02', 3, 'TRIPLE'::room_type)
ON CONFLICT (floor, room_number) DO UPDATE
SET capacity = EXCLUDED.capacity,
    type     = EXCLUDED.type;

INSERT INTO users (email, password_hash, room_id, personal_no, role, is_active)
VALUES
    ('a@dm.test',      '$2y$hash.admin', NULL, NULL, 'ADMIN'::user_role, TRUE),
    ('201-1@test',     '$$hash2011', (SELECT id FROM rooms WHERE floor = 2 AND room_number = '01'), 1, 'RESIDENT'::user_role, TRUE),
    ('202-1@test',     '$$hash2021', (SELECT id FROM rooms WHERE floor = 2 AND room_number = '02'), 1, 'RESIDENT'::user_role, TRUE),
    ('inspector@test', '$$hashinsp', NULL, NULL, 'INSPECTOR'::user_role, TRUE)
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
    v_unit_id       BIGINT;
    v_comp1         BIGINT;
    v_comp2         BIGINT;
    v_user_admin    BIGINT;
    v_user_201      BIGINT;
    v_user_202      BIGINT;
    v_user_inspector BIGINT;
    v_label         INTEGER;
    v_bundle_id     BIGINT;
    v_comp3         BIGINT;
    v_comp4         BIGINT;
    v_label_comp2   INTEGER;
    v_label_comp3   INTEGER;
    v_bundle_comp2  BIGINT;
    v_bundle_comp3  BIGINT;
    v_label_comp1_next INTEGER;
    v_bundle_comp1_next BIGINT;
    v_session2      BIGINT;
BEGIN
    -- 냉장고 본체
    INSERT INTO fridge_units (floor, unit_no, building)
    VALUES (2, 1, 'A')
    ON CONFLICT (floor, unit_no) DO UPDATE
    SET building = EXCLUDED.building
    RETURNING id INTO v_unit_id;

    IF v_unit_id IS NULL THEN
        SELECT id INTO v_unit_id FROM fridge_units WHERE floor = 2 AND unit_no = 1;
    END IF;

    -- 추가 검사 세션 (제출 완료 상태)
    INSERT INTO inspection_sessions (compartment_id, session_uuid, status, started_at, ended_at)
    VALUES (v_comp2, '22222222-2222-2222-2222-222222222222', 'SUBMITTED', CURRENT_TIMESTAMP - INTERVAL '12 hour', CURRENT_TIMESTAMP - INTERVAL '11 hour')
    ON CONFLICT (session_uuid) DO UPDATE
    SET compartment_id = EXCLUDED.compartment_id,
        status         = EXCLUDED.status,
        started_at     = EXCLUDED.started_at,
        ended_at       = EXCLUDED.ended_at;

    SELECT id INTO v_session2 FROM inspection_sessions WHERE session_uuid = '22222222-2222-2222-2222-222222222222';

    INSERT INTO inspection_inspectors (session_id, inspector_id)
    VALUES (v_session2, v_user_inspector)
    ON CONFLICT (session_id, inspector_id) DO NOTHING;

    IF NOT EXISTS (
        SELECT 1 FROM inspection_actions
        WHERE session_id = v_session2
          AND inspector_id = v_user_inspector
          AND bundle_id = v_bundle_comp2
          AND action_type_code = 'PASS'
    ) THEN
        INSERT INTO inspection_actions (session_id, inspector_id, bundle_id, action_type_code, memo)
        VALUES (v_session2, v_user_inspector, v_bundle_comp2, 'PASS', '정상 보관 확인');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM inspection_actions
        WHERE session_id = v_session2
          AND inspector_id = v_user_inspector
          AND bundle_id = v_bundle_comp3
          AND action_type_code = 'DISPOSE'
    ) THEN
        INSERT INTO inspection_actions (session_id, inspector_id, bundle_id, action_type_code, reason_code, memo)
        VALUES (v_session2, v_user_inspector, v_bundle_comp3, 'DISPOSE', 'STORAGE_ISSUE', '장기 방치로 폐기');
    END IF;

    -- 냉장고 칸
    INSERT INTO compartments (unit_id, display_order, type, label_range_start, label_range_end)
    VALUES
        (v_unit_id, 1, 'FRIDGE'::compartment_type, 1, 999),
        (v_unit_id, 2, 'FRIDGE'::compartment_type, 1, 999),
        (v_unit_id, 3, 'FRIDGE'::compartment_type, 1, 999),
        (v_unit_id, 4, 'FREEZER'::compartment_type, 1, 999)
    ON CONFLICT (unit_id, display_order) DO UPDATE
    SET type = EXCLUDED.type,
        label_range_start = EXCLUDED.label_range_start,
        label_range_end   = EXCLUDED.label_range_end;

    SELECT id INTO v_comp1 FROM compartments WHERE unit_id = v_unit_id AND display_order = 1;
    SELECT id INTO v_comp2 FROM compartments WHERE unit_id = v_unit_id AND display_order = 2;
    SELECT id INTO v_comp3 FROM compartments WHERE unit_id = v_unit_id AND display_order = 3;
    SELECT id INTO v_comp4 FROM compartments WHERE unit_id = v_unit_id AND display_order = 4;

    -- 배분 규칙 (존재하지 않을 때만 추가)
    IF NOT EXISTS (
        SELECT 1 FROM compartment_room_access
        WHERE compartment_id = v_comp1
          AND room_id = (SELECT id FROM rooms WHERE floor = 2 AND room_number = '01')
          AND active_to IS NULL
    ) THEN
        INSERT INTO compartment_room_access (compartment_id, room_id, allocation_rule, active_from, active_to)
        VALUES (v_comp1, (SELECT id FROM rooms WHERE floor = 2 AND room_number = '01'), 'DIRECT', DATE '2025-10-01', NULL);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM compartment_room_access
        WHERE compartment_id = v_comp2
          AND room_id = (SELECT id FROM rooms WHERE floor = 2 AND room_number = '02')
          AND active_to IS NULL
    ) THEN
        INSERT INTO compartment_room_access (compartment_id, room_id, allocation_rule, active_from, active_to)
        VALUES (v_comp2, (SELECT id FROM rooms WHERE floor = 2 AND room_number = '02'), 'DIRECT', DATE '2025-10-01', NULL);
    END IF;

    -- 라벨 풀 미리 생성
    WITH label_range AS (
        SELECT gs AS label_number
        FROM generate_series(1, 999) AS gs
    ),
    compartments_to_seed AS (
        SELECT v_comp1 AS compartment_id
        UNION ALL SELECT v_comp2
        UNION ALL SELECT v_comp3
        UNION ALL SELECT v_comp4
    )
    INSERT INTO label_pool (compartment_id, label_number, status)
    SELECT comp.compartment_id, label_range.label_number, 0
    FROM compartments_to_seed comp
    CROSS JOIN label_range
    ON CONFLICT (compartment_id, label_number) DO NOTHING;

    -- 주요 사용자 ID 캐시
    SELECT id INTO v_user_admin     FROM users WHERE email = 'a@dm.test';
    SELECT id INTO v_user_201       FROM users WHERE email = '201-1@test';
    SELECT id INTO v_user_202       FROM users WHERE email = '202-1@test';
    SELECT id INTO v_user_inspector FROM users WHERE email = 'inspector@test';

    -- 라벨 할당 및 묶음 생성
    SELECT label_number INTO v_label
    FROM label_pool
    WHERE compartment_id = v_comp1 AND status = 0
    ORDER BY label_number
    LIMIT 1
    FOR UPDATE;

    IF v_label IS NULL THEN
        RAISE EXCEPTION '사용 가능한 라벨을 찾을 수 없습니다. compartment_id=%', v_comp1;
    END IF;

    UPDATE label_pool
    SET status = 1,
        last_used_at = CURRENT_TIMESTAMP
    WHERE compartment_id = v_comp1
      AND label_number = v_label;

    INSERT INTO fridge_bundles (owner_id, compartment_id, label_number, bundle_name, status_code)
    VALUES (v_user_201, v_comp1, v_label, '아침 식재료', 'NORMAL')
    ON CONFLICT (compartment_id, label_number) DO UPDATE
    SET owner_id       = EXCLUDED.owner_id,
        compartment_id = EXCLUDED.compartment_id,
        bundle_name    = EXCLUDED.bundle_name,
        status_code    = EXCLUDED.status_code
    RETURNING id INTO v_bundle_id;

    IF v_bundle_id IS NULL THEN
        SELECT id INTO v_bundle_id FROM fridge_bundles WHERE compartment_id = v_comp1 AND label_number = v_label;
    END IF;

    UPDATE label_pool
    SET last_used_bundle_id = v_bundle_id
    WHERE compartment_id = v_comp1
      AND label_number = v_label;

    -- 추가: 202호 거주자의 야식 묶음 (정상/임박/만료 혼합)
    SELECT label_number INTO v_label_comp2
    FROM label_pool
    WHERE compartment_id = v_comp2 AND status = 0
    ORDER BY label_number
    LIMIT 1
    FOR UPDATE;

    IF v_label_comp2 IS NULL THEN
        RAISE EXCEPTION '사용 가능한 라벨을 찾을 수 없습니다. compartment_id=%', v_comp2;
    END IF;

    INSERT INTO fridge_bundles (owner_id, compartment_id, label_number, bundle_name, status_code)
    VALUES (v_user_202, v_comp2, v_label_comp2, '야식 식재료', 'NORMAL')
    ON CONFLICT (compartment_id, label_number) DO UPDATE
    SET owner_id       = EXCLUDED.owner_id,
        compartment_id = EXCLUDED.compartment_id,
        bundle_name    = EXCLUDED.bundle_name,
        status_code    = EXCLUDED.status_code
    RETURNING id INTO v_bundle_comp2;

    UPDATE label_pool
    SET status = 1,
        last_used_bundle_id = v_bundle_comp2,
        last_used_at = CURRENT_TIMESTAMP
    WHERE compartment_id = v_comp2
      AND label_number = v_label_comp2;

    IF NOT EXISTS (SELECT 1 FROM fridge_items WHERE bundle_id = v_bundle_comp2 AND item_name = '컵라면') THEN
        INSERT INTO fridge_items (bundle_id, item_name, expiry_date, state_code, memo)
        VALUES (v_bundle_comp2, '컵라면', CURRENT_DATE + INTERVAL '5 day', 'NORMAL', '야식용 간편식');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM fridge_items WHERE bundle_id = v_bundle_comp2 AND item_name = '치즈볼') THEN
        INSERT INTO fridge_items (bundle_id, item_name, expiry_date, state_code, memo)
        VALUES (v_bundle_comp2, '치즈볼', CURRENT_DATE + INTERVAL '1 day', 'IMMINENT', '오늘 안에 소진 권장');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM fridge_items WHERE bundle_id = v_bundle_comp2 AND item_name = '콜라 500ml') THEN
        INSERT INTO fridge_items (bundle_id, item_name, expiry_date, state_code, memo)
        VALUES (v_bundle_comp2, '콜라 500ml', CURRENT_DATE - INTERVAL '1 day', 'EXPIRED', '상미기한 경과');
    END IF;

    -- 추가: 201호의 냉동 보관 묶음 (폐기 상태 예시)
    SELECT label_number INTO v_label_comp3
    FROM label_pool
    WHERE compartment_id = v_comp4 AND status = 0
    ORDER BY label_number
    LIMIT 1
    FOR UPDATE;

    IF v_label_comp3 IS NULL THEN
        RAISE EXCEPTION '사용 가능한 라벨을 찾을 수 없습니다. compartment_id=%', v_comp4;
    END IF;

    INSERT INTO fridge_bundles (owner_id, compartment_id, label_number, bundle_name, status_code)
    VALUES (v_user_201, v_comp4, v_label_comp3, '장기 보관 냉동식품', 'DISPOSED')
    ON CONFLICT (compartment_id, label_number) DO UPDATE
    SET owner_id       = EXCLUDED.owner_id,
        compartment_id = EXCLUDED.compartment_id,
        bundle_name    = EXCLUDED.bundle_name,
        status_code    = EXCLUDED.status_code
    RETURNING id INTO v_bundle_comp3;

    UPDATE label_pool
    SET status = 1,
        last_used_bundle_id = v_bundle_comp3,
        last_used_at = CURRENT_TIMESTAMP
    WHERE compartment_id = v_comp4
      AND label_number = v_label_comp3;

    IF NOT EXISTS (SELECT 1 FROM fridge_items WHERE bundle_id = v_bundle_comp3 AND item_name = '냉동만두') THEN
        INSERT INTO fridge_items (bundle_id, item_name, expiry_date, state_code, memo)
        VALUES (v_bundle_comp3, '냉동만두', CURRENT_DATE - INTERVAL '5 day', 'DISPOSED', '폐기 처리 완료');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM fridge_items WHERE bundle_id = v_bundle_comp3 AND item_name = '아이스크림 팩') THEN
        INSERT INTO fridge_items (bundle_id, item_name, expiry_date, state_code, memo)
        VALUES (v_bundle_comp3, '아이스크림 팩', CURRENT_DATE - INTERVAL '2 day', 'DISPOSED', '검사 중 폐기됨');
    END IF;

    -- 추가: 동일한 냉장 칸에 신규 라벨 배정 예시
    SELECT label_number INTO v_label_comp1_next
    FROM label_pool
    WHERE compartment_id = v_comp1 AND status = 0
    ORDER BY label_number
    LIMIT 1
    FOR UPDATE;

    IF v_label_comp1_next IS NOT NULL THEN
        INSERT INTO fridge_bundles (owner_id, compartment_id, label_number, bundle_name, status_code)
        VALUES (v_user_202, v_comp1, v_label_comp1_next, '공유 과일 바구니', 'NORMAL')
        ON CONFLICT (compartment_id, label_number) DO UPDATE
        SET owner_id       = EXCLUDED.owner_id,
            compartment_id = EXCLUDED.compartment_id,
            bundle_name    = EXCLUDED.bundle_name,
            status_code    = EXCLUDED.status_code
        RETURNING id INTO v_bundle_comp1_next;

        UPDATE label_pool
        SET status = 1,
            last_used_bundle_id = v_bundle_comp1_next,
            last_used_at = CURRENT_TIMESTAMP
        WHERE compartment_id = v_comp1
          AND label_number = v_label_comp1_next;

        IF NOT EXISTS (SELECT 1 FROM fridge_items WHERE bundle_id = v_bundle_comp1_next AND item_name = '사과 4개') THEN
            INSERT INTO fridge_items (bundle_id, item_name, expiry_date, state_code, memo)
            VALUES (v_bundle_comp1_next, '사과 4개', CURRENT_DATE + INTERVAL '6 day', 'NORMAL', '공용 간식');
        END IF;
    END IF;

    -- 아이템 예시 (중복 방지)
    IF NOT EXISTS (SELECT 1 FROM fridge_items WHERE bundle_id = v_bundle_id AND item_name = '계란') THEN
        INSERT INTO fridge_items (bundle_id, item_name, expiry_date, state_code, memo)
        VALUES (v_bundle_id, '계란', CURRENT_DATE + INTERVAL '3 day', 'IMMINENT', NULL);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM fridge_items WHERE bundle_id = v_bundle_id AND item_name = '우유') THEN
        INSERT INTO fridge_items (bundle_id, item_name, expiry_date, state_code, memo)
        VALUES (v_bundle_id, '우유', CURRENT_DATE + INTERVAL '1 day', 'IMMINENT', NULL);
    END IF;

    -- 알림 (야식 묶음 임박 및 검사 결과)
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
            'bundle_id', v_bundle_comp2,
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
        v_bundle_comp2
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
        jsonb_build_object('summary', '통과 1건, 폐기 1건이 기록되었습니다.'),
        jsonb_build_object(
            'type', 'INSPECTION_RESULT',
            'session_id', v_session2,
            'affected_bundles', 2,
            'actions', jsonb_build_array(
                jsonb_build_object('bundle_id', v_bundle_comp2, 'action', 'PASS'),
                jsonb_build_object('bundle_id', v_bundle_comp3, 'action', 'DISPOSE', 'reason', 'STORAGE_ISSUE')
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

    -- 알림 (냉장고 임박)
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
            'bundle_id', v_bundle_id,
            'item_count', 2,
            'warning_count', 1,
            'dispose_count', 0,
            'items', jsonb_build_array(
                jsonb_build_object(
                    'name', '계란',
                    'expiry_date', to_char(CURRENT_DATE + INTERVAL '3 day', 'YYYY-MM-DD'),
                    'state', 'IMMINENT'
                ),
                jsonb_build_object(
                    'name', '우유',
                    'expiry_date', to_char(CURRENT_DATE + INTERVAL '1 day', 'YYYY-MM-DD'),
                    'state', 'IMMINENT'
                )
            )
        ),
        rpad('demo_dedupe_key_201_2025_10_12_bundle_1', 64, 'x'),
        CURRENT_TIMESTAMP + INTERVAL '24 hour',
        v_bundle_id
    )
    ON CONFLICT (dedupe_key) DO UPDATE
    SET ttl_at           = EXCLUDED.ttl_at,
        preview_json     = EXCLUDED.preview_json,
        detail_json      = EXCLUDED.detail_json,
        related_bundle_id = EXCLUDED.related_bundle_id;

    -- 검사 세션 & 참여자
    INSERT INTO inspection_sessions (compartment_id, session_uuid, status)
    VALUES (v_comp1, '11111111-1111-1111-1111-111111111111', 'OPEN')
    ON CONFLICT (session_uuid) DO UPDATE
    SET compartment_id = EXCLUDED.compartment_id,
        status         = EXCLUDED.status;

    INSERT INTO inspection_inspectors (session_id, inspector_id)
    VALUES (
        (SELECT id FROM inspection_sessions WHERE session_uuid = '11111111-1111-1111-1111-111111111111'),
        v_user_inspector
    )
    ON CONFLICT (session_id, inspector_id) DO NOTHING;

    IF NOT EXISTS (
        SELECT 1 FROM inspection_actions
        WHERE session_id = (SELECT id FROM inspection_sessions WHERE session_uuid = '11111111-1111-1111-1111-111111111111')
          AND inspector_id = v_user_inspector
          AND bundle_id = v_bundle_id
          AND action_type_code = 'WARN'
    ) THEN
        INSERT INTO inspection_actions (
            session_id, inspector_id, bundle_id, action_type_code, reason_code, memo
        )
        VALUES (
            (SELECT id FROM inspection_sessions WHERE session_uuid = '11111111-1111-1111-1111-111111111111'),
            v_user_inspector,
            v_bundle_id,
            'WARN',
            'STICKER_MISSING',
            '스티커 위치 식별 어려움'
        );
    END IF;

    -- 검사 결과 알림
    INSERT INTO notifications (
        user_id, kind_code, title, preview_json, detail_json, dedupe_key,
        ttl_at, related_session_id
    )
    VALUES (
        v_user_201,
        'INSPECTION_RESULT',
        '냉장고 검사 결과',
        jsonb_build_object('summary', '검사 결과: 경고 1건, 폐기 0건'),
        jsonb_build_object(
            'type', 'INSPECTION_RESULT',
            'session_id', (SELECT id FROM inspection_sessions WHERE session_uuid = '11111111-1111-1111-1111-111111111111'),
            'affected_bundles', 1,
            'actions', jsonb_build_array(
                jsonb_build_object(
                    'bundle_id', v_bundle_id,
                    'action', 'WARN',
                    'reason', 'STICKER_MISSING'
                )
            )
        ),
        rpad('demo_dedupe_key_inspection_201', 64, 'y'),
        CURRENT_TIMESTAMP + INTERVAL '72 hour',
        (SELECT id FROM inspection_sessions WHERE session_uuid = '11111111-1111-1111-1111-111111111111')
    )
    ON CONFLICT (dedupe_key) DO UPDATE
    SET ttl_at             = EXCLUDED.ttl_at,
        preview_json       = EXCLUDED.preview_json,
        detail_json        = EXCLUDED.detail_json,
        related_session_id = EXCLUDED.related_session_id;

    -- 라벨 반환 시연
    UPDATE fridge_bundles
    SET status_code = 'REMOVED'
    WHERE id = v_bundle_id;

    -- 일반 공지 알림
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

    -- 관리자 작업 로그 예시
    IF NOT EXISTS (
        SELECT 1 FROM audit_logs
        WHERE actor_id = v_user_admin
          AND ref_id   = v_user_inspector
          AND action   = 'GRANT_INSPECTOR_ROLE'
    ) THEN
        INSERT INTO audit_logs (actor_id, actor_role_at_action, scope, ref_type, ref_id, action, after_json)
        VALUES (
            v_user_admin,
            'ADMIN',
            'USER',
            'User',
            v_user_inspector,
            'GRANT_INSPECTOR_ROLE',
            jsonb_build_object('previous_role', 'RESIDENT', 'new_role', 'INSPECTOR')
        );
    END IF;
END;
$$;
