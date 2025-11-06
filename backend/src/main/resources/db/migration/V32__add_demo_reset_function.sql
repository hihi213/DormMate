-- Demo 데이터 전체 리셋 유틸리티 함수 정의
-- 운영 환경에서는 호출하지 않는 것을 권장합니다.

SET TIME ZONE 'UTC';

CREATE OR REPLACE FUNCTION public.fn_reset_demo_dataset()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM set_config('TimeZone', 'UTC', true);

    RAISE NOTICE 'Releasing active room assignments for floors 2-5...';
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

    RAISE NOTICE 'Releasing current admin room assignment (if any)...';
    UPDATE room_assignment ra
    SET released_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE ra.released_at IS NULL
      AND ra.dorm_user_id IN (
            SELECT id FROM dorm_user WHERE lower(login_id) = 'dormmate'
        );

    RAISE NOTICE 'Seeding demo and resident accounts...';
    PERFORM public.fn_seed_demo_and_resident();

    RAISE NOTICE 'Marking inactive accounts outside demo/resident scope...';
    UPDATE dorm_user
    SET status = 'INACTIVE',
        updated_at = CURRENT_TIMESTAMP
    WHERE status = 'ACTIVE'
      AND login_id NOT LIKE 'resident%'
      AND lower(login_id) NOT IN ('dormmate','alice','bob','carol','dylan','diana','eric','fiona')
      AND id NOT IN (
            SELECT dorm_user_id
            FROM room_assignment
            WHERE released_at IS NULL
        );

    RAISE NOTICE 'Rebuilding fridge preset data...';
    PERFORM public.fn_seed_fridge_presets();

    RAISE NOTICE 'Refreshing resident display names and fridge labels...';
    PERFORM public.fn_refresh_names_and_labels();

    RAISE NOTICE 'Demo dataset reset completed.';
END;
$$;

-- Demo 환경에서는 아래 함수를 직접 호출해 전체 초기화를 수행합니다.
--   SELECT public.fn_reset_demo_dataset();
