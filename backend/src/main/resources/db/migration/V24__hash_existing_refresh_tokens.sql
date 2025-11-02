-- 기존 평문 refresh_token을 SHA-256 해시로 변환한다.
-- 해시 기반 세션 검증으로 전환하면서 과거 세션이 모두 무효화되는 문제를 방지하기 위함이다.

SET TIME ZONE 'UTC';

DO $$
BEGIN
    -- pgcrypto 확장이 없으면 활성화한다.
    PERFORM 1
      FROM pg_catalog.pg_extension
     WHERE extname = 'pgcrypto';
    IF NOT FOUND THEN
        CREATE EXTENSION IF NOT EXISTS pgcrypto;
    END IF;
END $$;

UPDATE user_session
   SET refresh_token = encode(digest(refresh_token, 'sha256'), 'hex'),
       updated_at = CURRENT_TIMESTAMP
 WHERE length(refresh_token) <> 64;
