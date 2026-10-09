-- 초기 관리자 발급 여부는 계정 비활성화/역할 해제와 무관하게 유지한다.
CREATE TABLE admin_bootstrap_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    completed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
