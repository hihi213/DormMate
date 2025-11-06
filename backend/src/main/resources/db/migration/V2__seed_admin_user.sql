-- Seed 기본 ACTIVE 관리자 계정 및 권한
-- 관리자 아이디·비밀번호는 Flyway placeholder(admin_login, admin_password)로 주입하며
-- 미설정 시 기본값 dormmate / admin1! 로 초기화합니다.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
    v_admin_id uuid := '11111111-1111-1111-1111-111111111111';
    v_room_id uuid;
    v_admin_login text := nullif(trim(${admin_login}), '');
    v_admin_password text := nullif(${admin_password}, '');
BEGIN
    IF v_admin_login IS NULL THEN
        v_admin_login := 'dormmate';
    END IF;

    IF v_admin_password IS NULL THEN
        v_admin_password := 'admin1!';
    END IF;

    INSERT INTO role (code, name, description, created_at, updated_at)
    VALUES ('ADMIN', '관리자', '시스템 전역 관리자', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (code) DO UPDATE
    SET name = EXCLUDED.name,
        description = EXCLUDED.description,
        updated_at = CURRENT_TIMESTAMP;

    SELECT id INTO v_room_id
    FROM room
    WHERE floor = 3 AND room_number = '01'
    LIMIT 1;

    IF v_room_id IS NULL THEN
        INSERT INTO room (id, floor, room_number, room_type, capacity, created_at, updated_at)
        VALUES (gen_random_uuid(), 3, '01', 'SINGLE', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (floor, room_number) DO NOTHING;

        SELECT id INTO v_room_id
        FROM room
        WHERE floor = 3 AND room_number = '01'
        LIMIT 1;
    END IF;

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

    IF v_room_id IS NOT NULL THEN
        INSERT INTO room_assignment (id, room_id, dorm_user_id, personal_no, assigned_at, created_at, updated_at)
        VALUES (
            gen_random_uuid(),
            v_room_id,
            v_admin_id,
            1,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        )
        ON CONFLICT (room_id, personal_no) WHERE released_at IS NULL DO NOTHING;
    END IF;
END $$;
