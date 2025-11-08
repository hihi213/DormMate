-- 더 이상 사용하지 않는 데모 초기화 스크립트를 무력화한다.

SET TIME ZONE 'UTC';

DO $$
BEGIN
    -- 이전 버전에서 정의했던 데모/리셋 함수가 남아있다면 제거한다.
    PERFORM 1
    FROM pg_proc
    WHERE proname = 'fn_seed_fridge_presets' AND pg_function_is_visible(oid);

    IF FOUND THEN
        EXECUTE 'DROP FUNCTION IF EXISTS public.fn_seed_fridge_presets() CASCADE';
    END IF;

    PERFORM 1
    FROM pg_proc
    WHERE proname = 'fn_reset_demo_dataset' AND pg_function_is_visible(oid);

    IF FOUND THEN
        EXECUTE 'DROP FUNCTION IF EXISTS public.fn_reset_demo_dataset() CASCADE';
    END IF;
END;
$$;
