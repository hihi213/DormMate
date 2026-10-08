-- 기존 repeatable 적용 이력을 유지하는 비파괴 마이그레이션.
-- 초기화 본문은 db/demo/fridge_reset.sql로 분리했다.
-- 기존 DB에 남은 데모 함수도 제거하며 업무 데이터는 변경하지 않는다.
DROP FUNCTION IF EXISTS public.fn_demo_reset_fridge();
