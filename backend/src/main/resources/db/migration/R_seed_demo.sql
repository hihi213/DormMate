-- =========================================================
-- R_seed_demo.sql — 로컬/스테이징 데모 데이터 (운영 금지)
--  • 전제: R_schema.sql + R_seed.sql 적용 후
--  • 주의: 비번 해시는 반드시 데모용/임시 해시 사용
-- =========================================================

BEGIN;

-- 1) 데모 입주자 2명
DO $$
DECLARE v_hash1 TEXT := current_setting('app.demo_user1_hash', true);
DECLARE v_hash2 TEXT := current_setting('app.demo_user2_hash', true);
DECLARE u1 BIGINT; DECLARE u2 BIGINT;
BEGIN
  IF v_hash1 IS NOT NULL AND btrim(v_hash1) <> '' THEN
    INSERT INTO users(username, email, password_hash, display_name, is_active)
    VALUES ('resident_201_1', '201-1@demo.local', v_hash1, '201-1', TRUE)
    ON CONFLICT (username) DO NOTHING
    RETURNING user_id INTO u1;
  END IF;

  IF v_hash2 IS NOT NULL AND btrim(v_hash2) <> '' THEN
    INSERT INTO users(username, email, password_hash, display_name, is_active)
    VALUES ('resident_201_2', '201-2@demo.local', v_hash2, '201-2', TRUE)
    ON CONFLICT (username) DO NOTHING
    RETURNING user_id INTO u2;
  END IF;
END$$;

-- 2) 데모 아이템: 2F 냉장1/2
WITH r AS (
  SELECT resource_id, label
  FROM resources
  WHERE floor_code='2F' AND label IN ('냉장1','냉장2')
)
INSERT INTO item_bundles(resource_id, owner_user_id, label_no, name, quantity, expires_on, memo)
SELECT r.resource_id,
       (SELECT user_id FROM users WHERE username='resident_201_1'),
       101, '우유', 1, CURRENT_DATE + INTERVAL '7 days', '데모'
FROM r WHERE r.label='냉장1'
ON CONFLICT DO NOTHING;

INSERT INTO item_bundles(resource_id, owner_user_id, label_no, name, quantity, expires_on, memo)
SELECT r.resource_id,
       (SELECT user_id FROM users WHERE username='resident_201_2'),
       102, '김치', 1, CURRENT_DATE + INTERVAL '30 days', '데모'
FROM resources r
WHERE r.floor_code='2F' AND r.label='냉장2'
ON CONFLICT DO NOTHING;

COMMIT;
