-- 자동 시드 리프레시
-- 목적: 함수 업데이트 이후 기존 데이터를 새 규칙으로 재구성한다.

SET TIME ZONE 'UTC';

SELECT public.fn_populate_fridge_auto_seed(20);
