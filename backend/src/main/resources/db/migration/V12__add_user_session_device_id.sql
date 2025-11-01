-- DormMate 인증 세션에 device_id 컬럼 추가
-- 근거: docs/feature-inventory.md §1, docs/ops/security-checklist.md §1

ALTER TABLE user_session
    ADD COLUMN IF NOT EXISTS device_id VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_user_session_device
    ON user_session (dorm_user_id, device_id)
    WHERE revoked_at IS NULL;
