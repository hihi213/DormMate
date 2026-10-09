ALTER TABLE dorm_user ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE dorm_user ADD COLUMN credential_version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE dorm_user ADD COLUMN retired_at TIMESTAMPTZ;
ALTER TABLE user_session ADD COLUMN credential_version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE dorm_user DROP CONSTRAINT uq_dorm_user_login;
CREATE UNIQUE INDEX uq_current_user_login ON dorm_user(lower(login_id)) WHERE retired_at IS NULL;

CREATE TABLE resident_account_slot (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES room(id),
    personal_no SMALLINT NOT NULL CHECK (personal_no > 0),
    current_user_id UUID NOT NULL UNIQUE REFERENCES dorm_user(id),
    UNIQUE(room_id, personal_no)
);

-- 빈 자리는 초기 비밀번호 0000의 비활성 계정으로 준비한다. 기존 계정은 수정하지 않는다.
INSERT INTO dorm_user(id, login_id, password_hash, full_name, email, status, must_change_password)
SELECT gen_random_uuid(), concat(r.floor, r.room_number, '-', n), crypt('0000', gen_salt('bf', 10)),
       '미입사', concat(r.floor, r.room_number, '-', n, '@unassigned.invalid'), 'INACTIVE', TRUE
FROM room r CROSS JOIN LATERAL generate_series(1, r.capacity) n
WHERE NOT EXISTS (SELECT 1 FROM dorm_user u
    WHERE lower(u.login_id)=lower(concat(r.floor, r.room_number, '-', n)) AND u.retired_at IS NULL);
INSERT INTO resident_account_slot(room_id, personal_no, current_user_id)
SELECT r.id, n, u.id FROM room r CROSS JOIN LATERAL generate_series(1, r.capacity) n
JOIN dorm_user u ON u.login_id=concat(r.floor, r.room_number, '-', n) AND u.retired_at IS NULL;
