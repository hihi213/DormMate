-- 자동 냉장고 시드 로직은 프리셋 함수로 대체한다.
-- 기존 fn_populate_fridge_auto_seed 호출을 유지하면서 내부적으로 프리셋 리셋 함수를 실행한다.

SET TIME ZONE 'UTC';

CREATE OR REPLACE FUNCTION public.fn_populate_fridge_auto_seed(target_limit INTEGER DEFAULT 20)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE NOTICE 'fn_populate_fridge_auto_seed(target_limit=%) delegates to fn_seed_fridge_presets()', target_limit;
    PERFORM public.fn_seed_fridge_presets();
END;
$$;

SELECT public.fn_populate_fridge_auto_seed();
