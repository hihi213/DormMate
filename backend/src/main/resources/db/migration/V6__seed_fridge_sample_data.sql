-- 초기 데모용 냉장고 샘플 데이터는 더 이상 제공하지 않는다.
-- 구조 데이터는 후속 마이그레이션(V37)에서 채워진다.

SET TIME ZONE 'UTC';

DO $$
BEGIN
    RAISE NOTICE 'V6__seed_fridge_sample_data: demo sample bundles are no longer seeded.';
END $$;
