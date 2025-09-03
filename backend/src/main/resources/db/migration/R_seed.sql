-- =========================================================
-- R_seed.sql — 운영/스테이징 공용 기본 시드 (멱등)
--  • 전제: R_schema.sql 로 모든 DDL이 적용된 상태
--  • 관리자/층별장 계정은 환경변수로 해시를 주입한 경우에만 생성
--    - SET app.admin_password_hash     = '<bcrypt_or_argon2_here>';
--    - SET app.fm_2f_password_hash     = '<hash>'; -- 2F 층별장(옵션)
--    - SET app.fm_3f_password_hash     = '<hash>'; -- 3F 층별장(옵션)
--    - SET app.fm_4f_password_hash     = '<hash>'; -- 4F 층별장(옵션)
--    - SET app.fm_5f_password_hash     = '<hash>'; -- 5F 층별장(옵션)
-- =========================================================

BEGIN;

-- 1) 층별 리소스(2F~5F): 냉장칸 3 + 냉동칸 1
WITH floors(code) AS (
  VALUES ('2F'), ('3F'), ('4F'), ('5F')
),
labels(lbl) AS (
  VALUES ('냉장1'), ('냉장2'), ('냉장3'), ('냉동1')
)
INSERT INTO resources(type, floor_code, label, status)
SELECT 'FRIDGE_COMP', f.code, l.lbl, 'ACTIVE'
FROM floors f CROSS JOIN labels l
ON CONFLICT (type, floor_code, label) DO NOTHING;

-- 2) 관리자 계정(옵션): 해시가 주입된 경우에만 생성
DO $$
DECLARE v_hash TEXT := current_setting('app.admin_password_hash', true);
DECLARE v_uid  BIGINT;
BEGIN
  IF v_hash IS NOT NULL AND btrim(v_hash) <> '' THEN
    INSERT INTO users(username, email, password_hash, display_name, is_active)
    VALUES ('admin', 'admin@example.local', v_hash, '관리자', TRUE)
    ON CONFLICT (username) DO NOTHING
    RETURNING user_id INTO v_uid;

    IF v_uid IS NULL THEN
      SELECT user_id INTO v_uid FROM users WHERE username='admin';
    END IF;

    IF v_uid IS NOT NULL THEN
      INSERT INTO user_roles(user_id, role_id)
      SELECT v_uid, role_id FROM roles WHERE name='ADMIN'
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END$$;

-- 3) 층별장 계정(옵션): 각 층별 해시 주입 시 생성 + INSPECTOR 롤 부여
DO $$
DECLARE
  rec RECORD;
  v_uid BIGINT;
  v_hash TEXT;
BEGIN
  FOR rec IN SELECT * FROM (VALUES
    ('2F','floorlead_2f','app.fm_2f_password_hash','2층 층별장','fl2@example.local'),
    ('3F','floorlead_3f','app.fm_3f_password_hash','3층 층별장','fl3@example.local'),
    ('4F','floorlead_4f','app.fm_4f_password_hash','4층 층별장','fl4@example.local'),
    ('5F','floorlead_5f','app.fm_5f_password_hash','5층 층별장','fl5@example.local')
  ) AS t(floor_code, uname, guc_key, disp, email)
  LOOP
    v_hash := current_setting(rec.guc_key, true);
    IF v_hash IS NOT NULL AND btrim(v_hash) <> '' THEN
      INSERT INTO users(username, email, password_hash, display_name, is_active)
      VALUES (rec.uname, rec.email, v_hash, rec.disp, TRUE)
      ON CONFLICT (username) DO NOTHING
      RETURNING user_id INTO v_uid;

      IF v_uid IS NULL THEN
        SELECT user_id INTO v_uid FROM users WHERE username=rec.uname;
      END IF;

      IF v_uid IS NOT NULL THEN
        INSERT INTO user_roles(user_id, role_id)
        SELECT v_uid, role_id FROM roles WHERE name='INSPECTOR'
        ON CONFLICT DO NOTHING;
        -- ⚠️ 층 권한은 MVP에선 JWT 클레임으로 전달(예: floors:["2F"])
        -- DB 매핑은 R8 권역 권한 릴리스에서 도입 예정
      END IF;
    END IF;
  END LOOP;
END$$;

COMMIT;
