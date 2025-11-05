-- 배포 데이터 보정 2차
-- 목적:
--   1. 2~5층 호실 배정을 초기화하고 데모/기본 거주자 시드를 재적용한다.
--   2. 관리자(admin) 계정의 호실 배정을 해제한다.
--   3. 비활성화 대상 잔여 계정을 정리한다.
--   4. 냉장/냉동 칸 특성을 고려한 프리셋 데이터를 다시 채운다.

SET TIME ZONE 'UTC';

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) 2~5층 호실 배정 초기화
WITH target_assignments AS (
    SELECT ra.id
    FROM room_assignment ra
    JOIN room r ON r.id = ra.room_id
    WHERE r.floor BETWEEN 2 AND 5
      AND ra.released_at IS NULL
)
UPDATE room_assignment
SET released_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE id IN (SELECT id FROM target_assignments);

-- 2) 관리자(admin) 계정 호실 배정 해제
UPDATE room_assignment ra
SET released_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE ra.released_at IS NULL
  AND ra.dorm_user_id IN (
        SELECT id FROM dorm_user WHERE lower(login_id) = 'admin'
    );

-- 3) 기본 호실/데모/거주자 시드 재적용 (공통 함수 호출)
SELECT public.fn_seed_demo_and_resident();

-- 4) 잔여 계정 정리 (resident 패턴 및 데모/관리자 제외)
UPDATE dorm_user
SET status = 'INACTIVE',
    updated_at = CURRENT_TIMESTAMP
WHERE status = 'ACTIVE'
  AND login_id NOT LIKE 'resident%'
  AND lower(login_id) NOT IN ('admin','alice','bob','carol','dylan','diana','eric','fiona')
  AND id NOT IN (
        SELECT dorm_user_id
        FROM room_assignment
        WHERE released_at IS NULL
    );

-- 5) 냉장고 프리셋 데이터 리셋 및 시드 함수 정의
CREATE OR REPLACE FUNCTION public.fn_seed_fridge_presets()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_deleted integer;
    v_bundles integer;
    v_items integer;
BEGIN
    PERFORM set_config('TimeZone', 'UTC', true);

    DELETE FROM inspection_action_item;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE 'Removed inspection_action_item rows: %', v_deleted;

    DELETE FROM inspection_action;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE 'Removed inspection_action rows: %', v_deleted;

    DELETE FROM fridge_item;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE 'Removed fridge_item rows: %', v_deleted;

    DELETE FROM fridge_bundle;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE 'Removed fridge_bundle rows: %', v_deleted;

    DELETE FROM bundle_label_sequence;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE 'Removed bundle_label_sequence rows: %', v_deleted;

    DROP TABLE IF EXISTS tmp_preset_bundles;
    CREATE TEMP TABLE tmp_preset_bundles ON COMMIT DROP AS
    WITH bundle_defs AS (
        SELECT *
        FROM (VALUES
            ('alice', 2, 0, 1,   '아침 샐러드 박스',   '샐러드와 요거트를 신선하게 보관'),
            ('bob',   2, 1, 2,   '야식 라면팩',       '야간 자습용 라면과 토핑'),
            ('dylan', 2, 3, 3,   '아이스크림 모음',   '냉동실 간식 아이스크림'),
            ('diana', 3, 0, 101, '브런치 샐러드 키트','채소와 견과류 구성'),
            ('eric',  3, 1, 201, '탄산음료 박스',     '차갑게 마시는 탄산음료 모음'),
            ('fiona', 3, 3, 301, '냉동 간편식 박스',  '야식용 냉동 간편식'),
            ('405-1', 4, 0, 410, '4층 과일 바구니',   '공용으로 나누는 제철 과일'),
            ('405-1', 4, 3, 411, '4층 냉동 간식',     '공용 아이스크림과 빙과류'),
            ('505-1', 5, 0, 510, '5층 샌드위치 세트', '아침 식사용 샌드위치 재료'),
            ('505-1', 5, 3, 511, '5층 냉동 비상식',   '비상 시 먹는 냉동식품')
        ) AS v(login_id, floor_no, slot_index, label_number, bundle_name, memo)
    ),
    bundle_targets AS (
        SELECT
            bd.label_number,
            du.id AS owner_id,
            fc.id AS compartment_id,
            bd.bundle_name,
            bd.memo
        FROM bundle_defs bd
        JOIN dorm_user du ON du.login_id = bd.login_id
        JOIN fridge_unit fu ON fu.floor_no = bd.floor_no
        JOIN fridge_compartment fc
             ON fc.fridge_unit_id = fu.id
            AND fc.slot_index = bd.slot_index
        WHERE fc.status = 'ACTIVE'
    ),
    inserted AS (
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
            bt.owner_id,
            bt.compartment_id,
            bt.label_number,
            bt.bundle_name,
            bt.memo,
            'ACTIVE',
            NULL,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        FROM bundle_targets bt
        RETURNING id, fridge_compartment_id, label_number
    )
    SELECT * FROM inserted;

    SELECT COUNT(*) INTO v_bundles FROM tmp_preset_bundles;
    RAISE NOTICE 'Inserted preset fridge bundles: %', v_bundles;

    WITH item_defs AS (
        SELECT *
        FROM (VALUES
            (1,   '루꼴라 샐러드',      1, 'PACK',  (CURRENT_DATE + INTERVAL '3 day')::DATE),
            (1,   '그릭요거트',        2, 'CUP',   (CURRENT_DATE + INTERVAL '5 day')::DATE),
            (2,   '신라면 블랙',       2, 'PACK',  (CURRENT_DATE + INTERVAL '15 day')::DATE),
            (2,   '모짜렐라 치즈',     1, 'PACK',  (CURRENT_DATE + INTERVAL '7 day')::DATE),
            (3,   '바밤바',            4, 'EACH',  (CURRENT_DATE + INTERVAL '30 day')::DATE),
            (3,   '누가바',            3, 'EACH',  (CURRENT_DATE + INTERVAL '35 day')::DATE),
            (3,   '빵또아',            2, 'EACH',  (CURRENT_DATE + INTERVAL '40 day')::DATE),
            (101, '훈제 닭가슴살',     2, 'PACK',  (CURRENT_DATE + INTERVAL '6 day')::DATE),
            (101, '아몬드 브리즈',     2, 'CARTON',(CURRENT_DATE + INTERVAL '8 day')::DATE),
            (201, '코카콜라 제로',     3, 'BOTTLE',(CURRENT_DATE + INTERVAL '20 day')::DATE),
            (201, '스프라이트',        2, 'BOTTLE',(CURRENT_DATE + INTERVAL '18 day')::DATE),
            (301, '갈릭 닭가슴살 구이',2, 'PACK',  (CURRENT_DATE + INTERVAL '25 day')::DATE),
            (301, '김치만두',         15, 'EACH',  (CURRENT_DATE + INTERVAL '45 day')::DATE),
            (410, '샤인머스캣',        1, 'BOX',   (CURRENT_DATE + INTERVAL '5 day')::DATE),
            (410, '제주 햇귤',        6, 'EACH',  (CURRENT_DATE + INTERVAL '4 day')::DATE),
            (411, '폴라포',            6, 'EACH',  (CURRENT_DATE + INTERVAL '50 day')::DATE),
            (411, '와플바',            4, 'EACH',  (CURRENT_DATE + INTERVAL '45 day')::DATE),
            (510, '햄치즈 샌드위치',   2, 'PACK',  (CURRENT_DATE + INTERVAL '2 day')::DATE),
            (510, '토마토 바질 샐러드',1, 'PACK',  (CURRENT_DATE + INTERVAL '3 day')::DATE),
            (511, '떡갈비',            8, 'EACH',  (CURRENT_DATE + INTERVAL '35 day')::DATE),
            (511, '에어프라이 감자',  1, 'PACK',  (CURRENT_DATE + INTERVAL '32 day')::DATE)
        ) AS v(label_number, item_name, quantity, unit_code, expiry_date)
    )
    INSERT INTO fridge_item (
        id,
        fridge_bundle_id,
        item_name,
        quantity,
        status,
        deleted_at,
        created_at,
        updated_at,
        unit_code,
        expiry_date
    )
    SELECT
        gen_random_uuid(),
        tp.id,
        idf.item_name,
        idf.quantity,
        'ACTIVE',
        NULL,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        idf.unit_code,
        idf.expiry_date
    FROM item_defs idf
    JOIN tmp_preset_bundles tp ON tp.label_number = idf.label_number;

    GET DIAGNOSTICS v_items = ROW_COUNT;
    RAISE NOTICE 'Inserted preset fridge items: %', v_items;

    WITH max_labels AS (
        SELECT
            fb.fridge_compartment_id AS compartment_id,
            MAX(fb.label_number) + 1 AS next_number
        FROM fridge_bundle fb
        WHERE fb.status = 'ACTIVE'
        GROUP BY fb.fridge_compartment_id
    )
    INSERT INTO bundle_label_sequence (
        fridge_compartment_id,
        next_number,
        created_at,
        updated_at,
        recycled_numbers
    )
    SELECT
        ml.compartment_id,
        ml.next_number,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        '[]'::jsonb
    FROM max_labels ml
    ON CONFLICT (fridge_compartment_id) DO UPDATE
    SET
        next_number = EXCLUDED.next_number,
        updated_at = CURRENT_TIMESTAMP,
        recycled_numbers = '[]'::jsonb;
END;
$$;

SELECT public.fn_seed_fridge_presets();
