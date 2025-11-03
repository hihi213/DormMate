-- 관리자 정책 테이블 생성

SET TIME ZONE 'UTC';

CREATE TABLE admin_policy (
    id UUID PRIMARY KEY,
    notification_batch_time TIME NOT NULL,
    notification_daily_limit INTEGER NOT NULL,
    notification_ttl_hours INTEGER NOT NULL,
    penalty_limit INTEGER NOT NULL,
    penalty_template TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO admin_policy (
    id,
    notification_batch_time,
    notification_daily_limit,
    notification_ttl_hours,
    penalty_limit,
    penalty_template
)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '09:00',
    20,
    24,
    10,
    'DormMate 벌점 누적 {점수}점으로 세탁실/다목적실/도서관 이용이 7일간 제한됩니다. 냉장고 기능은 유지됩니다.'
)
ON CONFLICT (id) DO UPDATE
SET notification_batch_time = EXCLUDED.notification_batch_time,
    notification_daily_limit = EXCLUDED.notification_daily_limit,
    notification_ttl_hours = EXCLUDED.notification_ttl_hours,
    penalty_limit = EXCLUDED.penalty_limit,
    penalty_template = EXCLUDED.penalty_template,
    updated_at = CURRENT_TIMESTAMP;
