-- 배포 데이터 보정 2차
-- 목적:
--   1. 2~5층 호실 배정을 초기화하고 데모/기본 거주자 시드를 재적용한다.
--   2. 관리자(admin) 계정의 호실 배정을 해제한다.
--   3. 비활성화 대상 잔여 계정을 정리한다.
--   4. 냉장/냉동 칸 특성을 고려한 프리셋 데이터를 다시 채운다.

SET TIME ZONE 'UTC';

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.fn_seed_fridge_presets()
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
    v_now TIMESTAMP WITH TIME ZONE := CURRENT_TIMESTAMP;
    v_removed INTEGER;
    v_admin_id UUID;
    v_session_id UUID;
    v_bundle_id UUID;
    v_bundle_owner UUID;
    v_action_id BIGINT;
    v_item_id UUID;
    v_item_name TEXT;
    v_item_expiry DATE;
    v_item_qty INTEGER;
    v_bundle_count INTEGER;
    v_inspector_id UUID;
    comp_owner_ids UUID[];
    comp_owner_count INTEGER;
    label_number INTEGER;
    items_per_bundle INTEGER;
    spec_idx INTEGER;
    product_array TEXT[];
    product_len INTEGER;
    item_spec TEXT;
    item_parts TEXT[];
    bundle_name TEXT;
    bundle_memo TEXT;
    title_idx INTEGER;
    descriptor_idx INTEGER;
    memo_idx INTEGER;
    total_bundles INTEGER := 0;
    total_items INTEGER := 0;
    chill_titles CONSTANT TEXT[] := ARRAY[
        '모닝 샐러드 바','야식 라면 키트','브런치 플래터','허브 라이스 박스',
        '그릭요거트 스테이션','과일 디스펜서','델리 콤보 박스','스프 & 스튜 키트',
        '프로틴 밀프렙','낮잠 도시락','에너지 스낵 팩','카페 테이블 세트'
    ];
    chill_descriptors CONSTANT TEXT[] := ARRAY[
        '시그니처','레몬 허니','오리엔탈','리코타','크런치','스파이시','테라스',
        '하우스 블렌드','새벽 시장','로스트 치킨','라이트핏','터프데이'
    ];
    chill_memos CONSTANT TEXT[] := ARRAY[
        '신선 야채와 드레싱 포함','야간 이용자를 위한 든든한 구성',
        '즉석 조리로 완성하는 포만감 세트','허브 향미가 도는 저염 레시피',
        '주간 공동 주방 인기 메뉴','시험 기간 집중 보조식','카페 스타일 가니쉬 포함',
        '외부 반입 제한 품목 없음','공유 파티용으로 추천되는 구성','칼로리 정보 표기 완료',
        '프리미엄 토핑 2종 포함','최근 입고된 신선 재료 위주'
    ];
    freeze_titles CONSTANT TEXT[] := ARRAY[
        '냉동 디저트 트레이','야식 아이스 앤 스낵','밤샘 간식 박스','아이스바 스테이션',
        '셀프 컵빙수 라인','쿨링 디저트 박스','스무디 블렌드 팩','한밤 젤라또 트렁크',
        '파티 아이스크림 스택','폴라 스낵 라인','북극 미니바','스노우 스낵 키트'
    ];
    freeze_descriptors CONSTANT TEXT[] := ARRAY[
        '바닐라 믹스','초콜릿 셀렉션','민트 크런치','망고 브리즈','베리 페스티벌',
        '홍시 클래식','말차 스페셜','쿠키앤크림 에디션','블루베리 샤베트','피넛버터',
        '카라멜 리본','유자 프레시'
    ];
    freeze_memos CONSTANT TEXT[] := ARRAY[
        '빙수 컵과 시럽 세트 동봉','시험주 대비 야간 간식 전용','공용 냉동고 전용 라벨 부착 완료',
        '냉동 유지 온도 -18℃ 검증','재입고 알림 구독자 추천 메뉴','스쿨마켓 인기 제품 위주 구성',
        '피크타임 공동 이용자들 요청 반영','초저온 유지가 필요한 제품 포함','알레르기 정보 안내 스티커 부착',
        '이벤트용 남은 수량 정리','보관 용기 포함 패키지','단체 모임 예약 수요 대응 구성'
    ];
    chill_products CONSTANT TEXT[] := ARRAY[
        '풀무원_그린샐러드|PACK|1|4',
        '곰곰_샐러드토핑|PACK|1|15',
        '서울우유_저지방우유|BOTTLE|2|7',
        '매일유업_그릭요거트|CUP|4|8',
        '프레시지_닭가슴살샐러드|PACK|1|5',
        '썬키스트_자몽슬라이스|PACK|1|4',
        '델몬트_방울토마토|PACK|1|5',
        '농심_신라면컵|CUP|2|20',
        'CJ_햇반현미밥|BOWL|2|120',
        'SPC_크루아상|EACH|4|3',
        '던킨_미니도넛|EACH|3|3',
        '오뚜기_참기름|BOTTLE|1|180',
        '곰곰_하루견과|PACK|2|60',
        'CJ_리코타치즈|PACK|1|12',
        '풀무원_훈제연어|PACK|1|6',
        '매일유업_두유|BOTTLE|3|20',
        '빙그레_요플레플레인|CUP|4|14',
        '샘표_비빔장|PACK|1|90',
        '프레시지_버섯샤브육수|PACK|1|10',
        '오뚜기_컵밥불고기|CUP|2|30',
        '곰곰_키위슬라이스|PACK|1|5',
        '빙그레_바나나우유|BOTTLE|2|8',
        '풀무원_오곡시리얼|PACK|1|90',
        '곰곰_플레인요거트|CUP|3|9',
        '오뚜기_컵누들|CUP|2|25'
    ];
    freeze_products CONSTANT TEXT[] := ARRAY[
        '빙그레_바밤바|EACH|6|45',
        '롯데_누가바|EACH|6|45',
        '빙그레_메로나|EACH|8|45',
        '롯데_죠스바|EACH|8|45',
        '롯데_월드콘바닐라|EACH|6|60',
        '빙그레_슈퍼콘초코|EACH|6|60',
        '하겐다즈_미니컵바닐라|CUP|4|90',
        '하겐다즈_미니컵딸기|CUP|4|90',
        '롯데_폴라포|EACH|10|45',
        '빙그레_빵또아|EACH|6|30',
        '롯데_찰옥수수아이스|EACH|6|45',
        '빙그레_투게더바닐라|TUB|1|90',
        '빙그레_투게더초코|TUB|1|90',
        '롯데_젤리셔스아이스젤리|PACK|4|60',
        '빙그레_설레임밀크|EACH|8|45',
        '롯데_빠삐코초코|EACH|8|45',
        '빙그레_요플레아이스|EACH|8|30',
        '빙그레_쿠앤크콘|EACH|6|60',
        '롯데_빅구슬빙수|PACK|2|30',
        '빙그레_빙수떡|PACK|2|30',
        '롯데_와플바|EACH|6|45',
        '롯데_아이스홀릭민트|EACH|6|60',
        '빙그레_젤라또망고|CUP|4|60',
        '빙그레_젤라또피스타치오|CUP|4|60',
        '롯데_아이스호떡|PACK|2|60',
        '비비고_새우왕교자|BAG|1|120',
        '풀무원_바삭김말이|BAG|1|90',
        '오뚜기_피자밀키트|PACK|1|40'
    ];
    comp RECORD;
    rec RECORD;
    action_type TEXT;
    action_reason TEXT;
    action_note TEXT;
    session_note TEXT;
    rec_owner_ids UUID[];
BEGIN
    PERFORM set_config('TimeZone', 'UTC', true);

    DELETE FROM inspection_action_item;
    GET DIAGNOSTICS v_removed = ROW_COUNT;
    RAISE NOTICE 'Removed inspection_action_item rows: %', v_removed;

    DELETE FROM inspection_action;
    GET DIAGNOSTICS v_removed = ROW_COUNT;
    RAISE NOTICE 'Removed inspection_action rows: %', v_removed;

    DELETE FROM unregistered_item_event;
    GET DIAGNOSTICS v_removed = ROW_COUNT;
    RAISE NOTICE 'Removed unregistered_item_event rows: %', v_removed;

    DELETE FROM inspection_participant;
    GET DIAGNOSTICS v_removed = ROW_COUNT;
    RAISE NOTICE 'Removed inspection_participant rows: %', v_removed;

    DELETE FROM inspection_schedule;
    GET DIAGNOSTICS v_removed = ROW_COUNT;
    RAISE NOTICE 'Removed inspection_schedule rows: %', v_removed;

    DELETE FROM inspection_session;
    GET DIAGNOSTICS v_removed = ROW_COUNT;
    RAISE NOTICE 'Removed inspection_session rows: %', v_removed;

    DELETE FROM fridge_item;
    GET DIAGNOSTICS v_removed = ROW_COUNT;
    RAISE NOTICE 'Removed fridge_item rows: %', v_removed;

    DELETE FROM fridge_bundle;
    GET DIAGNOSTICS v_removed = ROW_COUNT;
    RAISE NOTICE 'Removed fridge_bundle rows: %', v_removed;

    DELETE FROM bundle_label_sequence;
    GET DIAGNOSTICS v_removed = ROW_COUNT;
    RAISE NOTICE 'Removed bundle_label_sequence rows: %', v_removed;

    PERFORM public.fn_rebuild_compartment_access();

    SELECT id INTO v_admin_id
    FROM dorm_user
    WHERE login_id = 'dormmate'
    LIMIT 1;

    CREATE TEMP TABLE tmp_compartment_owners ON COMMIT DROP AS
    SELECT
        fc.id AS compartment_id,
        fu.floor_no,
        fc.compartment_type,
        fc.slot_index,
        array_remove(array_agg(ra.dorm_user_id ORDER BY du.full_name, du.login_id), NULL) AS owner_ids
    FROM fridge_compartment fc
    JOIN fridge_unit fu ON fu.id = fc.fridge_unit_id
    LEFT JOIN compartment_room_access cra
           ON cra.fridge_compartment_id = fc.id
          AND cra.released_at IS NULL
    LEFT JOIN room_assignment ra
           ON ra.room_id = cra.room_id
          AND ra.released_at IS NULL
    LEFT JOIN dorm_user du ON du.id = ra.dorm_user_id
    WHERE fc.status = 'ACTIVE'
      AND fu.status = 'ACTIVE'
    GROUP BY fc.id, fu.floor_no, fc.compartment_type, fc.slot_index;

    CREATE TEMP TABLE tmp_floor_managers ON COMMIT DROP AS
    SELECT DISTINCT ON (r.floor)
        r.floor AS floor_no,
        ur.dorm_user_id
    FROM user_role ur
    JOIN dorm_user du ON du.id = ur.dorm_user_id
    JOIN room_assignment ra ON ra.dorm_user_id = du.id AND ra.released_at IS NULL
    JOIN room r ON r.id = ra.room_id
    WHERE ur.role_code = 'FLOOR_MANAGER'
      AND ur.revoked_at IS NULL
    ORDER BY r.floor, du.login_id;

    FOR comp IN
        SELECT compartment_id, floor_no, compartment_type, slot_index, owner_ids
        FROM tmp_compartment_owners
        ORDER BY floor_no, compartment_type, slot_index
    LOOP
        comp_owner_ids := comp.owner_ids;
        comp_owner_count := COALESCE(array_length(comp_owner_ids, 1), 0);

        IF comp_owner_count = 0 THEN
            IF v_admin_id IS NOT NULL THEN
                comp_owner_ids := ARRAY[v_admin_id];
                comp_owner_count := 1;
            ELSE
                CONTINUE;
            END IF;
        END IF;

        SELECT dorm_user_id
        INTO v_inspector_id
        FROM tmp_floor_managers
        WHERE floor_no = comp.floor_no
        LIMIT 1;

        IF v_inspector_id IS NULL THEN
            v_inspector_id := comp_owner_ids[1];
        END IF;

        IF v_inspector_id IS NULL THEN
            v_inspector_id := v_admin_id;
        END IF;

        IF comp.compartment_type = 'CHILL' THEN
            product_array := chill_products;
            product_len := array_length(chill_products, 1);
        ELSE
            product_array := freeze_products;
            product_len := array_length(freeze_products, 1);
        END IF;

        IF product_len IS NULL OR product_len = 0 THEN
            CONTINUE;
        END IF;

        FOR label_number IN 1..10 LOOP
            v_bundle_id := gen_random_uuid();
            v_bundle_owner := comp_owner_ids[((label_number - 1) % comp_owner_count) + 1];

            IF comp.compartment_type = 'CHILL' THEN
                title_idx := ((comp.floor_no * 13 + comp.slot_index * 7 + label_number) % array_length(chill_titles, 1)) + 1;
                descriptor_idx := ((comp.slot_index * 11 + label_number * 3) % array_length(chill_descriptors, 1)) + 1;
                memo_idx := ((comp.floor_no + label_number * 2) % array_length(chill_memos, 1)) + 1;
                bundle_name := chill_titles[title_idx] || ' - ' || chill_descriptors[descriptor_idx];
                bundle_memo := chill_memos[memo_idx];
            ELSE
                title_idx := ((comp.floor_no * 11 + comp.slot_index * 5 + label_number) % array_length(freeze_titles, 1)) + 1;
                descriptor_idx := ((comp.slot_index * 13 + label_number * 4) % array_length(freeze_descriptors, 1)) + 1;
                memo_idx := ((comp.floor_no + label_number) % array_length(freeze_memos, 1)) + 1;
                bundle_name := freeze_titles[title_idx] || ' - ' || freeze_descriptors[descriptor_idx];
                bundle_memo := freeze_memos[memo_idx];
            END IF;

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
            VALUES (
                v_bundle_id,
                v_bundle_owner,
                comp.compartment_id,
                label_number,
                bundle_name,
                bundle_memo,
                'ACTIVE',
                NULL,
                v_now,
                v_now
            );

            total_bundles := total_bundles + 1;

            IF comp.compartment_type = 'CHILL' THEN
                items_per_bundle := 2 + ((label_number + comp.slot_index) % 2);
            ELSE
                items_per_bundle := 3;
            END IF;

            FOR spec_idx IN 0..(items_per_bundle - 1) LOOP
                item_spec := product_array[((comp.floor_no * 37
                                             + comp.slot_index * 11
                                             + label_number * 5
                                             + spec_idx) % product_len) + 1];
                item_parts := string_to_array(item_spec, '|');

                IF array_length(item_parts, 1) < 4 THEN
                    CONTINUE;
                END IF;

                v_item_name := replace(item_parts[1], '_', ' ');
                v_item_qty := GREATEST(1, COALESCE(item_parts[3], '1')::INTEGER);
                v_item_expiry := (v_now + (COALESCE(item_parts[4], '14')::INTEGER || ' days')::INTERVAL)::DATE;

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
                VALUES (
                    gen_random_uuid(),
                    v_bundle_id,
                    v_item_name,
                    v_item_qty,
                    'ACTIVE',
                    NULL,
                    v_now,
                    v_now,
                    item_parts[2],
                    v_item_expiry
                );

                total_items := total_items + 1;
            END LOOP;
        END LOOP;

        INSERT INTO bundle_label_sequence (
            fridge_compartment_id,
            next_number,
            created_at,
            updated_at,
            recycled_numbers
        )
        VALUES (
            comp.compartment_id,
            11,
            v_now,
            v_now,
            '[]'::jsonb
        )
        ON CONFLICT (fridge_compartment_id) DO UPDATE
        SET next_number = 11,
            updated_at = v_now,
            recycled_numbers = '[]'::jsonb;
    END LOOP;

    IF v_admin_id IS NOT NULL THEN
        FOR rec IN
            SELECT
                fc.id AS fridge_compartment_id,
                fu.floor_no,
                fc.slot_index,
                fc.compartment_type
            FROM fridge_compartment fc
            JOIN fridge_unit fu ON fu.id = fc.fridge_unit_id
            WHERE fc.status = 'ACTIVE'
              AND fu.status = 'ACTIVE'
            ORDER BY fu.floor_no, fc.slot_index
        LOOP
            v_inspector_id := NULL;

            SELECT owner_ids
            INTO rec_owner_ids
            FROM tmp_compartment_owners
            WHERE compartment_id = rec.fridge_compartment_id
            LIMIT 1;

            SELECT dorm_user_id
            INTO v_inspector_id
            FROM tmp_floor_managers
            WHERE floor_no = rec.floor_no
            LIMIT 1;

            IF v_inspector_id IS NULL AND rec_owner_ids IS NOT NULL AND array_length(rec_owner_ids, 1) > 0 THEN
                v_inspector_id := rec_owner_ids[1];
            END IF;

            IF v_inspector_id IS NULL THEN
                v_inspector_id := v_admin_id;
            END IF;

            SELECT COUNT(*)
            INTO v_bundle_count
            FROM fridge_bundle
            WHERE fridge_compartment_id = rec.fridge_compartment_id;

            IF v_bundle_count = 0 THEN
                CONTINUE;
            END IF;

            CASE ((rec.slot_index + rec.floor_no) % 3)
                WHEN 0 THEN
                    action_type := 'PASS';
                    action_reason := NULL;
                    action_note := format('칸 %s-%s 정기 점검 PASS', rec.floor_no, rec.slot_index);
                    session_note := '데모 초기화 자동 생성 점검 - 전 항목 이상 없음';
                WHEN 1 THEN
                    action_type := 'WARN_STORAGE_POOR';
                    action_reason := 'TEMP_HIGH';
                    action_note := format('칸 %s-%s 냉장 온도 재점검 요청', rec.floor_no, rec.slot_index);
                    session_note := '데모 초기화 자동 생성 점검 - 냉장 온도 이상 감지';
                ELSE
                    action_type := 'DISPOSE_EXPIRED';
                    action_reason := 'EXPIRED_ITEM';
                    action_note := format('칸 %s-%s 임박 품목 폐기', rec.floor_no, rec.slot_index);
                    session_note := '데모 초기화 자동 생성 점검 - 임박/만료 품목 정리';
            END CASE;

            INSERT INTO inspection_session (
                id,
                fridge_compartment_id,
                started_by,
                status,
                started_at,
                ended_at,
                submitted_by,
                submitted_at,
                total_bundle_count,
                notes,
                created_at,
                updated_at,
                initial_bundle_count
            )
            VALUES (
                gen_random_uuid(),
                rec.fridge_compartment_id,
                v_inspector_id,
                'SUBMITTED',
                v_now - INTERVAL '2 days',
                v_now - INTERVAL '2 days' + INTERVAL '30 minutes',
                v_inspector_id,
                v_now - INTERVAL '2 days' + INTERVAL '30 minutes',
                v_bundle_count,
                session_note,
                v_now,
                v_now,
                v_bundle_count
            )
            RETURNING id INTO v_session_id;

            SELECT fb.id, COALESCE(fb.owner_user_id, v_admin_id)
            INTO v_bundle_id, v_bundle_owner
            FROM fridge_bundle fb
            WHERE fb.fridge_compartment_id = rec.fridge_compartment_id
            ORDER BY fb.label_number
            LIMIT 1;

            IF v_bundle_id IS NULL THEN
                CONTINUE;
            END IF;

                INSERT INTO inspection_action (
                    fridge_bundle_id,
                    target_user_id,
                    action_type,
                    reason_code,
                free_note,
                    recorded_at,
                    recorded_by,
                    created_at,
                    updated_at,
                    inspection_session_id,
                    correlation_id
                )
                VALUES (
                    v_bundle_id,
                    v_bundle_owner,
                    action_type,
                    action_reason,
                    action_note,
                    v_now - INTERVAL '2 days' + INTERVAL '20 minutes',
                    v_inspector_id,
                    v_now,
                    v_now,
                    v_session_id,
                    gen_random_uuid()
                )
            RETURNING id INTO v_action_id;

            SELECT fi.id, fi.item_name, fi.expiry_date, fi.quantity
            INTO v_item_id, v_item_name, v_item_expiry, v_item_qty
            FROM fridge_item fi
            WHERE fi.fridge_bundle_id = v_bundle_id
            ORDER BY fi.created_at
            LIMIT 1;

            IF v_item_id IS NOT NULL THEN
                INSERT INTO inspection_action_item (
                    inspection_action_id,
                    fridge_item_id,
                    snapshot_name,
                    snapshot_expires_on,
                    quantity_at_action,
                    created_at,
                    updated_at,
                    correlation_id
                )
                VALUES (
                    v_action_id,
                    v_item_id,
                    v_item_name,
                    v_item_expiry,
                    COALESCE(v_item_qty, 0),
                    v_now,
                    v_now,
                    gen_random_uuid()
                );
            END IF;
        END LOOP;
    END IF;

    RAISE NOTICE 'Inserted preset fridge bundles: %', COALESCE(total_bundles, 0);
    RAISE NOTICE 'Inserted preset fridge items: %', COALESCE(total_items, 0);
END;
$function$;

-- Demo/테스트 환경에서는 수동으로 아래 함수를 호출해 냉장고 데이터를 재구성합니다.
--   SELECT public.fn_seed_fridge_presets();
