-- Regenerate admin password hash using injected credentials (fallback: dormmate/admin1!)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
    v_admin_login text := nullif(trim(${admin_login}), '');
    v_admin_password text := nullif(${admin_password}, '');
BEGIN
    IF v_admin_login IS NULL THEN
        v_admin_login := 'dormmate';
    END IF;

    IF v_admin_password IS NULL THEN
        v_admin_password := 'admin1!';
    END IF;

    UPDATE dorm_user
    SET password_hash = crypt(v_admin_password, gen_salt('bf', 12)),
        updated_at = CURRENT_TIMESTAMP
    WHERE login_id = v_admin_login;
END $$;
