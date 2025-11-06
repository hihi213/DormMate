-- 더 이상 사용하지 않는 자동 시드 함수 제거

SET TIME ZONE 'UTC';

DO $$
BEGIN
    PERFORM 1
    FROM pg_proc
    WHERE proname = 'fn_populate_fridge_auto_seed' AND pg_function_is_visible(oid);

    IF FOUND THEN
        EXECUTE 'DROP FUNCTION IF EXISTS public.fn_populate_fridge_auto_seed(INTEGER) CASCADE';
    END IF;
END;
$$;
