-- 더 이상 데모 계정을 복구하지 않는다.

SET TIME ZONE 'UTC';

DO $$
BEGIN
    RAISE NOTICE 'V23__reactivate_demo_accounts: no-op (demo users removed).';
END $$;
