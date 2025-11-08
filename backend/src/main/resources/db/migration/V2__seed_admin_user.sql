-- Seed 기본 ACTIVE 관리자 계정 및 권한
-- 사용 비밀번호: "admin1!" (DB 내에서 bcrypt 해시)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
    v_admin_id uuid := '11111111-1111-1111-1111-111111111111';
    v_admin_login text := 'dormmate';
    v_admin_password text := 'admin1!';
BEGIN
    INSERT INTO role (code, name, description, created_at, updated_at)
    VALUES ('ADMIN', '관리자', '시스템 전역 관리자', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (code) DO UPDATE
    SET name = EXCLUDED.name,
        description = EXCLUDED.description,
        updated_at = CURRENT_TIMESTAMP;

    INSERT INTO dorm_user (id, login_id, password_hash, full_name, email, status, created_at, updated_at)
    VALUES (
        v_admin_id,
        v_admin_login,
        crypt(v_admin_password, gen_salt('bf', 10)),
        'DormMate 관리자',
        format('%s@dormmate.dev', v_admin_login),
        'ACTIVE',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (login_id) DO UPDATE
    SET
        password_hash = EXCLUDED.password_hash,
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
    RETURNING id INTO v_admin_id;

    INSERT INTO user_role (id, dorm_user_id, role_code, granted_at, created_at, updated_at)
    VALUES (
        gen_random_uuid(),
        v_admin_id,
        'ADMIN',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (dorm_user_id, role_code) WHERE revoked_at IS NULL DO NOTHING;

END $$;
