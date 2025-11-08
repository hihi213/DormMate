-- Regenerate admin password hash using Postgres bcrypt support

CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE dorm_user
SET password_hash = crypt('admin1!', gen_salt('bf', 12)),
    updated_at = CURRENT_TIMESTAMP
WHERE login_id = 'dormmate';
