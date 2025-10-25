-- Seed 기본 ACTIVE 관리자 계정 및 권한
-- 사용 비밀번호: "password" (BCrypt 해시)

DO $$
DECLARE
    v_admin_id uuid := '11111111-1111-1111-1111-111111111111';
    v_room_id uuid;
BEGIN
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
        'admin',
        '$2a$10$7EqJtq98hPqEX7fNZaFWoOHi2hYc8lrU/47eT9vZ7B1cZ6F86iLaG',
        'DormMate 관리자',
        'admin@dormmate.dev',
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
