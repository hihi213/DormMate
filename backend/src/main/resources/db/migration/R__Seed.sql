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
    v_label_code    TEXT;
    v_bundle_id     BIGINT;
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

    -- 냉장고 칸
    INSERT INTO compartments (unit_id, slot_number, type, label_range_start, label_range_end)
    VALUES
        (v_unit_id, 1, 'FRIDGE'::compartment_type, 1, 50),
        (v_unit_id, 2, 'FREEZER'::compartment_type, 51, 100)
    ON CONFLICT (unit_id, slot_number) DO UPDATE
    SET type = EXCLUDED.type,
        label_range_start = EXCLUDED.label_range_start,
        label_range_end   = EXCLUDED.label_range_end;

    SELECT id INTO v_comp1 FROM compartments WHERE unit_id = v_unit_id AND slot_number = 1;
    SELECT id INTO v_comp2 FROM compartments WHERE unit_id = v_unit_id AND slot_number = 2;

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
    INSERT INTO label_pool (compartment_id, label_number, status)
    SELECT v_comp1, gs, 0 FROM generate_series(1, 10) AS gs
    ON CONFLICT (compartment_id, label_number) DO NOTHING;

    INSERT INTO label_pool (compartment_id, label_number, status)
    SELECT v_comp2, gs, 0 FROM generate_series(51, 60) AS gs
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

    v_label_code := format('1-%s', lpad(v_label::TEXT, 3, '0'));

    INSERT INTO fridge_bundles (owner_id, compartment_id, label_code, bundle_name, status_code)
    VALUES (v_user_201, v_comp1, v_label_code, '아침 식재료', 'NORMAL')
    ON CONFLICT (label_code) DO UPDATE
    SET owner_id       = EXCLUDED.owner_id,
        compartment_id = EXCLUDED.compartment_id,
        bundle_name    = EXCLUDED.bundle_name,
        status_code    = EXCLUDED.status_code
    RETURNING id INTO v_bundle_id;

    IF v_bundle_id IS NULL THEN
        SELECT id INTO v_bundle_id FROM fridge_bundles WHERE label_code = v_label_code;
    END IF;

    UPDATE label_pool
    SET last_used_bundle_id = v_bundle_id
    WHERE compartment_id = v_comp1
      AND label_number = v_label;

    -- 아이템 예시 (중복 방지)
    IF NOT EXISTS (SELECT 1 FROM fridge_items WHERE bundle_id = v_bundle_id AND item_name = '계란') THEN
        INSERT INTO fridge_items (bundle_id, item_name, expiry_date, state_code, memo)
        VALUES (v_bundle_id, '계란', CURRENT_DATE + INTERVAL '3 day', 'IMMINENT', NULL);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM fridge_items WHERE bundle_id = v_bundle_id AND item_name = '우유') THEN
        INSERT INTO fridge_items (bundle_id, item_name, expiry_date, state_code, memo)
        VALUES (v_bundle_id, '우유', CURRENT_DATE + INTERVAL '1 day', 'IMMINENT', NULL);
    END IF;

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

