-- Demo 사용자 시드는 더 이상 사용되지 않는다.
-- 기존 버전 번호를 유지하기 위해 역할 업서트만 수행하고 데모 계정 생성은 생략한다.

SET TIME ZONE 'UTC';

INSERT INTO role (code, name, description, created_at, updated_at)
VALUES
    ('RESIDENT', '기숙사 거주자', '기본 거주자 권한', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('FLOOR_MANAGER', '층별장', '층별 냉장고 담당자', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (code) DO UPDATE
SET name        = EXCLUDED.name,
    description = EXCLUDED.description,
    updated_at  = CURRENT_TIMESTAMP;

DO $$
BEGIN
    RAISE NOTICE 'V5__seed_demo_users: demo account provisioning is now skipped.';
END $$;
