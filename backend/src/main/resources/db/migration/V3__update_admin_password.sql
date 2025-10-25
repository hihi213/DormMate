-- Regenerate admin password hash using Postgres bcrypt support

UPDATE dorm_user
SET password_hash = crypt('password', gen_salt('bf', 10)),
    updated_at = CURRENT_TIMESTAMP
WHERE login_id = 'admin';
