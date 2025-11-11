-- Demo 환경에서만 사용되는 냉장고 데이터 초기화 스크립트.
-- Flyway Repeatable 마이그레이션이므로 운영 환경에서는 실행하지 않는다.

SET TIME ZONE 'UTC';

CREATE OR REPLACE FUNCTION public.fn_demo_reset_fridge()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    demo_reference_date date := DATE '2025-11-12';
BEGIN
    PERFORM set_config('TimeZone', 'UTC', true);

    IF to_regclass('public.fridge_compartment') IS NULL THEN
        RAISE NOTICE 'Skipping demo reset: fridge schema not initialized';
        RETURN;
    END IF;

    -- 데모 정책상 냉장/냉동 칸 모두 허용량(기본 10개)을 보장한다.
    UPDATE fridge_compartment
    SET max_bundle_count = 10,
        updated_at = CURRENT_TIMESTAMP
    WHERE compartment_type IN ('CHILL', 'FREEZE')
      AND max_bundle_count <> 10;

    -- 기존 데이터 정리
    PERFORM
        (CASE WHEN to_regclass('public.inspection_action_item') IS NOT NULL THEN 1 END);
    IF FOUND THEN
        EXECUTE 'DELETE FROM inspection_action_item';
    END IF;

    PERFORM
        (CASE WHEN to_regclass('public.inspection_action') IS NOT NULL THEN 1 END);
    IF FOUND THEN
        EXECUTE 'DELETE FROM inspection_action';
    END IF;

    PERFORM
        (CASE WHEN to_regclass('public.penalty_history') IS NOT NULL THEN 1 END);
    IF FOUND THEN
        EXECUTE 'DELETE FROM penalty_history';
    END IF;

    PERFORM
        (CASE WHEN to_regclass('public.inspection_schedule') IS NOT NULL THEN 1 END);
    IF FOUND THEN
        EXECUTE 'DELETE FROM inspection_schedule';
    END IF;

    PERFORM
        (CASE WHEN to_regclass('public.inspection_session') IS NOT NULL THEN 1 END);
    IF FOUND THEN
        EXECUTE 'DELETE FROM inspection_session';
    END IF;

    PERFORM
        (CASE WHEN to_regclass('public.fridge_item') IS NOT NULL THEN 1 END);
    IF FOUND THEN
        EXECUTE 'DELETE FROM fridge_item';
    END IF;

    PERFORM
        (CASE WHEN to_regclass('public.fridge_bundle') IS NOT NULL THEN 1 END);
    IF FOUND THEN
        EXECUTE 'DELETE FROM fridge_bundle';
    END IF;

    PERFORM
        (CASE WHEN to_regclass('public.bundle_label_sequence') IS NOT NULL THEN 1 END);
    IF FOUND THEN
        EXECUTE 'DELETE FROM bundle_label_sequence';
    END IF;

    -- 층별장 역할 초기화
    IF to_regclass('public.user_role') IS NOT NULL THEN
        UPDATE user_role
        SET revoked_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE role_code = 'FLOOR_MANAGER'
          AND revoked_at IS NULL;

        WITH fm_targets AS (
            SELECT du.id AS dorm_user_id
            FROM dorm_user du
            WHERE du.login_id IN ('205-3', '305-3', '405-3', '505-3')
        )
        INSERT INTO user_role (id, dorm_user_id, role_code, granted_at, created_at, updated_at)
        SELECT
            gen_random_uuid(),
            dorm_user_id,
            'FLOOR_MANAGER',
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        FROM fm_targets
        ON CONFLICT (dorm_user_id, role_code) WHERE revoked_at IS NULL DO NOTHING;
    END IF;

    -- 템플릿 데이터 준비
    CREATE TEMP TABLE tmp_bundle_templates (
        ordinal integer PRIMARY KEY,
        bundle_name text,
        bundle_memo text
    ) ON COMMIT DROP;

    INSERT INTO tmp_bundle_templates (ordinal, bundle_name, bundle_memo)
    VALUES
        (1, '바밤바 냉동 바스켓', '시그니처 막대 아이스크림 모음'),
        (2, '누가바 레트로 스테이션', '복고 감성 막대 아이스크림 세트'),
        (3, '메로나 트로피컬 코너', '과일맛 아이스크림과 멀티팩'),
        (4, '월드콘 디저트 타워', '콘 타입 프리미엄 디저트'),
        (5, '옥동자 클래식 키트', '레트로 아이스크림과 크림 간식'),
        (6, '공동 비상식품', '비상 시 사용할 간편식'),
        (7, '홈카페 재료', '커피와 디저트 토핑'),
        (8, '채식 간편식', '채소 위주의 간편 조리 식단'),
        (9, '간식 상자', '쿠키와 견과류, 달콤한 간식'),
        (10, '스포츠 보충식', '운동 후 보충용 음료와 스낵');

    CREATE TEMP TABLE tmp_item_templates (
        bundle_ordinal integer,
        item_seq integer,
        item_name text,
        quantity integer,
        unit_code text,
        relative_days integer,
        PRIMARY KEY (bundle_ordinal, item_seq)
    ) ON COMMIT DROP;

    INSERT INTO tmp_item_templates (bundle_ordinal, item_seq, item_name, quantity, unit_code, relative_days)
    VALUES
        -- 1. 바밤바 냉동 바스켓
        (1, 1, '바밤바 6입', 6, 'EA', 16),
        (1, 2, '돼지바 클래식 6입', 6, 'EA', 20),
        (1, 3, '찰떡아이스 인절미 4입', 4, 'EA', -4),
        -- 2. 누가바 레트로 스테이션
        (2, 1, '누가바 6입', 6, 'EA', -7),
        (2, 2, '죠스바 6입', 6, 'EA', 2),
        (2, 3, '쌍쌍바 6입', 6, 'EA', 18),
        -- 3. 메로나 트로피컬 코너
        (3, 1, '메로나 멜론 8입', 8, 'EA', 23),
        (3, 2, '메로나 복숭아 8입', 8, 'EA', 23),
        (3, 3, '수박바 멀티팩', 3, 'PACK', 8),
        -- 4. 월드콘 디저트 타워
        (4, 1, '월드콘 초코 4입', 4, 'EA', 57),
        (4, 2, '월드콘 쿠앤크 4입', 4, 'EA', 43),
        (4, 3, '브라보콘 민트 4입', 4, 'EA', 6),
        -- 5. 옥동자 클래식 키트
        (5, 1, '옥동자 5입', 5, 'EA', -2),
        (5, 2, '구구바 크런치 5입', 5, 'EA', 10),
        (5, 3, '빵빠레 바닐라 4입', 4, 'EA', 3),
        -- 6. 공동 비상식품
        (6, 1, '비상 미니 파우치', 5, 'EA', 7),
        (6, 2, '즉석죽', 3, 'EA', 15),
        (6, 3, '생수 500ml', 6, 'BTL', 30),
        -- 7. 홈카페 재료
        (7, 1, '콜드브루 원액', 1, 'BTL', 9),
        (7, 2, '휘핑 크림', 1, 'CAN', 5),
        (7, 3, '카라멜 토핑', 1, 'JAR', 20),
        -- 8. 채식 간편식
        (8, 1, '채소 믹스팩', 2, 'PACK', 10),
        (8, 2, '렌틸콩 샐러드', 1, 'PACK', 6),
        (8, 3, '두부 스테이크', 2, 'EA', 8),
        -- 9. 간식 상자
        (9, 1, '수제 쿠키', 8, 'EA', 12),
        (9, 2, '믹스 견과', 4, 'PACK', 30),
        (9, 3, '말린 과일칩', 3, 'PACK', 25),
        -- 10. 스포츠 보충식
        (10, 1, '초콜릿 프로틴바', 6, 'EA', 14),
        (10, 2, '이온 음료', 3, 'BTL', 7),
        (10, 3, '바나나 쉐이크', 2, 'BTL', 3);

    CREATE TEMP TABLE tmp_occupant_pool (
        owner_id uuid,
        room_id uuid,
        floor_no integer,
        room_number text,
        personal_no integer,
        slot_index integer
    ) ON COMMIT DROP;

    INSERT INTO tmp_occupant_pool
    SELECT
        du.id,
        r.id,
        r.floor,
        r.room_number,
        ra.personal_no,
        ROW_NUMBER() OVER (
            PARTITION BY r.floor
            ORDER BY r.room_number::INTEGER, ra.personal_no
        ) - 1
    FROM room_assignment ra
    JOIN room r ON r.id = ra.room_id
    JOIN dorm_user du ON du.id = ra.dorm_user_id
    WHERE ra.released_at IS NULL
      AND r.floor BETWEEN 2 AND 5;

    CREATE TEMP TABLE tmp_room_chill_access (
        room_id uuid,
        fridge_compartment_id uuid,
        floor_no integer
    ) ON COMMIT DROP;

    INSERT INTO tmp_room_chill_access
    SELECT
        cra.room_id,
        cra.fridge_compartment_id,
        r.floor
    FROM compartment_room_access cra
    JOIN room r ON r.id = cra.room_id
    JOIN fridge_compartment fc ON fc.id = cra.fridge_compartment_id
    WHERE cra.released_at IS NULL
      AND r.floor BETWEEN 2 AND 5
      AND fc.compartment_type IN ('CHILL', 'FREEZE');

    CREATE TEMP TABLE tmp_bundle_assignments (
        compartment_id uuid,
        floor_no integer,
        owner_id uuid,
        bundle_rank integer
    ) ON COMMIT DROP;

    INSERT INTO tmp_bundle_assignments (compartment_id, floor_no, owner_id, bundle_rank)
    SELECT
        rca.fridge_compartment_id,
        rca.floor_no,
        op.owner_id,
        ROW_NUMBER() OVER (
            PARTITION BY rca.fridge_compartment_id
            ORDER BY op.floor_no, op.room_number::INTEGER, op.personal_no
        ) AS bundle_rank
    FROM tmp_room_chill_access rca
    JOIN tmp_occupant_pool op ON op.room_id = rca.room_id;

    DELETE FROM tmp_bundle_assignments
    WHERE bundle_rank > 10;

    CREATE TEMP TABLE tmp_demo_bundles (
        bundle_id uuid,
        fridge_compartment_id uuid,
        floor_no integer,
        label_number integer,
        owner_id uuid,
        bundle_name text,
        bundle_memo text,
        created_at timestamptz
    ) ON COMMIT DROP;

    INSERT INTO tmp_demo_bundles (
        bundle_id,
        fridge_compartment_id,
        floor_no,
        label_number,
        owner_id,
        bundle_name,
        bundle_memo,
        created_at
    )
    SELECT
        gen_random_uuid(),
        tba.compartment_id,
        tba.floor_no,
        tbt.ordinal,
        tba.owner_id,
        tbt.bundle_name,
        tbt.bundle_memo,
        CURRENT_TIMESTAMP
    FROM tmp_bundle_assignments tba
    JOIN tmp_bundle_templates tbt ON tbt.ordinal = tba.bundle_rank;

    -- 포장 및 물품 삽입
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
        bundle_id,
        owner_id,
        fridge_compartment_id,
        label_number,
        bundle_name,
        bundle_memo,
        'ACTIVE',
        NULL,
        created_at,
        created_at
    FROM tmp_demo_bundles;

    INSERT INTO fridge_item (
        id,
        fridge_bundle_id,
        item_name,
        quantity,
        unit_code,
        expiry_date,
        status,
        deleted_at,
        created_at,
        updated_at
    )
    SELECT
        gen_random_uuid(),
        tdb.bundle_id,
        tit.item_name,
        tit.quantity,
        tit.unit_code,
        (demo_reference_date + tit.relative_days),
        'ACTIVE',
        NULL,
        tdb.created_at,
        tdb.created_at
    FROM tmp_demo_bundles tdb
    JOIN tmp_item_templates tit ON tit.bundle_ordinal = tdb.label_number;

    INSERT INTO bundle_label_sequence (
        fridge_compartment_id,
        next_number,
        recycled_numbers,
        created_at,
        updated_at
    )
    SELECT
        tdb.fridge_compartment_id,
        11,
        '[]'::jsonb,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM tmp_demo_bundles tdb
    GROUP BY tdb.fridge_compartment_id
    ON CONFLICT (fridge_compartment_id) DO UPDATE
    SET next_number = 11,
        recycled_numbers = '[]'::jsonb,
        updated_at = CURRENT_TIMESTAMP;

    -- 층별장 검사 기록 생성
    CREATE TEMP TABLE tmp_floor_managers (
        floor_no integer,
        user_id uuid
    ) ON COMMIT DROP;

    INSERT INTO tmp_floor_managers
    SELECT
        r.floor,
        du.id
    FROM dorm_user du
    JOIN room_assignment ra ON ra.dorm_user_id = du.id
    JOIN room r ON r.id = ra.room_id
    WHERE ra.released_at IS NULL
      AND du.login_id IN ('205-3', '305-3', '405-3', '505-3');

    CREATE TEMP TABLE tmp_target_slots (
        compartment_id uuid,
        floor_no integer
    ) ON COMMIT DROP;

    INSERT INTO tmp_target_slots
    SELECT
        fc.id,
        fu.floor_no
    FROM fridge_compartment fc
    JOIN fridge_unit fu ON fu.id = fc.fridge_unit_id
    WHERE fc.slot_index = 0
      AND fu.floor_no BETWEEN 2 AND 5;

    CREATE TEMP TABLE tmp_sessions (
        session_id uuid,
        fridge_compartment_id uuid,
        started_by uuid,
        started_at timestamptz,
        floor_no integer
    ) ON COMMIT DROP;

    WITH inserted AS (
        INSERT INTO inspection_session (
            id,
            fridge_compartment_id,
            status,
            started_at,
            created_at,
            updated_at,
            started_by
        )
        SELECT
            gen_random_uuid(),
            ts.compartment_id,
            'SUBMITTED',
            CURRENT_TIMESTAMP - make_interval(hours => (ts.floor_no - 1) * 4),
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP,
            fm.user_id
        FROM tmp_target_slots ts
        JOIN tmp_floor_managers fm ON fm.floor_no = ts.floor_no
        RETURNING id, fridge_compartment_id, started_by, started_at
    )
    INSERT INTO tmp_sessions (session_id, fridge_compartment_id, started_by, started_at, floor_no)
    SELECT
        ins.id,
        ins.fridge_compartment_id,
        ins.started_by,
        ins.started_at,
        ts.floor_no
    FROM inserted ins
    JOIN tmp_target_slots ts ON ts.compartment_id = ins.fridge_compartment_id;

    CREATE TEMP TABLE tmp_floor_bundles (
        floor_no integer,
        bundle_id uuid,
        owner_id uuid,
        label_number integer
    ) ON COMMIT DROP;

    INSERT INTO tmp_floor_bundles
    SELECT DISTINCT ON (floor_no)
        floor_no,
        bundle_id,
        owner_id,
        label_number
    FROM tmp_demo_bundles
    ORDER BY floor_no, label_number;

    CREATE TEMP TABLE tmp_actions (
        action_id bigint,
        inspection_session_id uuid,
        fridge_bundle_id uuid,
        action_type text
    ) ON COMMIT DROP;

    WITH inserted AS (
        INSERT INTO inspection_action (
            inspection_session_id,
            fridge_bundle_id,
            action_type,
            recorded_at,
            recorded_by,
            target_user_id,
            free_note
        )
        SELECT
            ts.session_id,
            fb.bundle_id,
            CASE WHEN fb.label_number <= 2 THEN 'DISPOSE_EXPIRED' ELSE 'WARN_INFO_MISMATCH' END,
            ts.started_at + interval '10 minutes',
            ts.started_by,
            fb.owner_id,
            CASE WHEN fb.label_number <= 2 THEN '만료된 데모 물품 폐기' ELSE '정보 정비 필요' END
        FROM tmp_sessions ts
        JOIN tmp_floor_bundles fb ON fb.floor_no = ts.floor_no
        RETURNING id, inspection_session_id, fridge_bundle_id, action_type
    )
    INSERT INTO tmp_actions (action_id, inspection_session_id, fridge_bundle_id, action_type)
    SELECT id, inspection_session_id, fridge_bundle_id, action_type FROM inserted;

    CREATE TEMP TABLE tmp_bundle_items (
        fridge_bundle_id uuid,
        fridge_item_id uuid,
        item_name text,
        expiry_date date,
        quantity integer
    ) ON COMMIT DROP;

    INSERT INTO tmp_bundle_items
    SELECT DISTINCT ON (fi.fridge_bundle_id)
        fi.fridge_bundle_id,
        fi.id,
        fi.item_name,
        fi.expiry_date,
        fi.quantity
    FROM fridge_item fi
    WHERE fi.fridge_bundle_id IN (SELECT bundle_id FROM tmp_demo_bundles)
    ORDER BY fi.fridge_bundle_id, fi.expiry_date;

    INSERT INTO inspection_action_item (
        inspection_action_id,
        fridge_item_id,
        snapshot_name,
        snapshot_expires_on,
        quantity_at_action,
        correlation_id
    )
    SELECT
        ta.action_id,
        bi.fridge_item_id,
        bi.item_name,
        bi.expiry_date,
        bi.quantity,
        gen_random_uuid()
    FROM tmp_actions ta
    JOIN tmp_bundle_items bi ON bi.fridge_bundle_id = ta.fridge_bundle_id;

    INSERT INTO penalty_history (
        id,
        user_id,
        issuer_id,
        inspection_action_id,
        source,
        points,
        reason,
        issued_at,
        created_at,
        updated_at
    )
    SELECT
        gen_random_uuid(),
        fb.owner_id,
        ia.recorded_by,
        ia.id,
        'FRIDGE_INSPECTION',
        1,
        ia.action_type,
        ia.recorded_at,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM inspection_action ia
    JOIN tmp_sessions ts ON ts.session_id = ia.inspection_session_id
    JOIN tmp_floor_bundles fb ON fb.bundle_id = ia.fridge_bundle_id
    WHERE ia.inspection_session_id IN (SELECT session_id FROM tmp_sessions)
      AND ia.action_type IN ('DISPOSE_EXPIRED', 'UNREGISTERED_DISPOSE');

    -- 정책상 칸-호실 접근권을 즉시 복구한다.
    PERFORM 1
    FROM pg_proc
    WHERE proname = 'fn_rebuild_compartment_room_access'
      AND pg_function_is_visible(oid);

    IF FOUND THEN
        PERFORM public.fn_rebuild_compartment_room_access();
    END IF;
END;
$$;

SELECT public.fn_demo_reset_fridge();
