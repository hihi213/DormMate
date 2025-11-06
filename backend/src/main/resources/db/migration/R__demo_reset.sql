-- Demo 환경에서만 사용되는 냉장고 데이터 초기화 스크립트.
-- Flyway Repeatable 마이그레이션이므로 운영 환경에서는 실행하지 않는다.

SET TIME ZONE 'UTC';

CREATE OR REPLACE FUNCTION public.fn_demo_reset_fridge()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    PERFORM set_config('TimeZone', 'UTC', true);

    IF to_regclass('public.fridge_compartment') IS NULL THEN
        RAISE NOTICE 'Skipping demo reset: fridge schema not initialized';
        RETURN;
    END IF;

    -- 기존 검사/냉장고 데이터를 제거 (존재 여부 확인 후 실행)
    IF to_regclass('public.inspection_action_item') IS NOT NULL THEN
        EXECUTE 'DELETE FROM inspection_action_item';
    END IF;
    IF to_regclass('public.inspection_action') IS NOT NULL THEN
        EXECUTE 'DELETE FROM inspection_action';
    END IF;
    IF to_regclass('public.fridge_item') IS NOT NULL THEN
        EXECUTE 'DELETE FROM fridge_item';
    END IF;
    IF to_regclass('public.fridge_bundle') IS NOT NULL THEN
        EXECUTE 'DELETE FROM fridge_bundle';
    END IF;
    IF to_regclass('public.bundle_label_sequence') IS NOT NULL THEN
        EXECUTE 'DELETE FROM bundle_label_sequence';
    END IF;

    WITH occupant_pool AS (
        SELECT
            du.id AS owner_id,
            r.floor,
            ROW_NUMBER() OVER (
                PARTITION BY r.floor
                ORDER BY r.room_number::INTEGER, ra.personal_no
            ) - 1 AS slot_index
        FROM room_assignment ra
        JOIN room r ON r.id = ra.room_id
        JOIN dorm_user du ON du.id = ra.dorm_user_id
        WHERE ra.released_at IS NULL
          AND r.floor BETWEEN 2 AND 5
    ),
    compartment_pool AS (
        SELECT
            fc.id AS compartment_id,
            fu.floor_no,
            ROW_NUMBER() OVER (
                PARTITION BY fu.floor_no
                ORDER BY fc.slot_index
            ) - 1 AS compartment_group
        FROM fridge_compartment fc
        JOIN fridge_unit fu ON fu.id = fc.fridge_unit_id
        WHERE fc.status = 'ACTIVE'
          AND fu.status = 'ACTIVE'
          AND fu.floor_no BETWEEN 2 AND 5
),
    bundles AS (
        SELECT
            cp.compartment_id,
            op.owner_id,
            ROW_NUMBER() OVER (
                PARTITION BY cp.compartment_id
                ORDER BY op.slot_index
            ) AS bundle_rank
        FROM compartment_pool cp
        JOIN occupant_pool op
          ON op.floor = cp.floor_no
         AND op.slot_index / 10 = cp.compartment_group
    ),
    bundles_limited AS (
        SELECT *
        FROM bundles
        WHERE bundle_rank <= 10
    ),
    bundle_templates AS (
        SELECT ordinal, name AS bundle_name, memo
        FROM (VALUES
            (1, '아침 과일 박스', '상큼한 과일과 요거트 모음'),
            (2, '늦은 밤 라면 세트', '야간 자습 후 즐기는 라면'),
            (3, '냉음료 모음', '탄산음료와 주스'),
            (4, '주말 브런치 키트', '샌드위치와 샐러드 재료'),
            (5, '야식 냉동 코너', '냉동만두와 간식 거리'),
            (6, '공동 비상식품', '비상 시 사용할 간편식'),
            (7, '홈카페 재료', '커피와 디저트 토핑'),
            (8, '채식 간편식', '채소 위주의 간편 조리 식단'),
            (9, '간식 상자', '쿠키와 견과류, 달콤한 간식'),
            (10,'스포츠 보충식', '운동 후 보충용 음료와 스낵')
        ) AS t(ordinal, name, memo)
    ),
    item_templates AS (
        SELECT ordinal, item_name, quantity, unit_code, shelf_days
        FROM (VALUES
            (1, '제주 감귤', 5, 'EA', 4),
            (2, '매운맛 컵라면', 3, 'EA', 20),
            (3, '탄산수', 4, 'BTL', 30),
            (4, '훈제 닭가슴살', 2, 'PACK', 7),
            (5, '갈릭 만두', 12, 'EA', 45),
            (6, '비상 미니 파우치', 5, 'EA', 180),
            (7, '콜드브루 원액', 1, 'BTL', 14),
            (8, '채소 믹스팩', 2, 'PACK', 5),
            (9, '수제 쿠키', 8, 'EA', 10),
            (10, '초콜릿 프로틴바', 6, 'EA', 60)
        ) AS t(ordinal, item_name, quantity, unit_code, shelf_days)
    ),
    inserted_bundles AS (
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
            bl.owner_id,
            bl.compartment_id,
            bt.ordinal,
            bt.bundle_name,
            bt.memo,
            'ACTIVE',
            NULL,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        FROM bundles_limited bl
        JOIN bundle_templates bt ON bt.ordinal = bl.bundle_rank
        RETURNING id, fridge_compartment_id, label_number, created_at
    )
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
        ib.id,
        it.item_name,
        it.quantity,
        it.unit_code,
        (CURRENT_DATE + make_interval(days => it.shelf_days))::DATE,
        'ACTIVE',
        NULL,
        ib.created_at,
        ib.created_at
    FROM inserted_bundles ib
    JOIN item_templates it ON it.ordinal = ib.label_number;

    INSERT INTO bundle_label_sequence (fridge_compartment_id, next_number, recycled_numbers, created_at, updated_at)
    SELECT
        fc.id,
        11,
        '[]'::jsonb,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM fridge_compartment fc
    JOIN fridge_unit fu ON fu.id = fc.fridge_unit_id
    WHERE fc.status = 'ACTIVE'
      AND fu.status = 'ACTIVE'
      AND fu.floor_no BETWEEN 2 AND 5
    ON CONFLICT (fridge_compartment_id) DO UPDATE
    SET next_number = 11,
        updated_at = CURRENT_TIMESTAMP;
END;
$$;

SELECT public.fn_demo_reset_fridge();

DROP FUNCTION public.fn_demo_reset_fridge();
