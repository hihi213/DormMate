-- 냉장고 검사 일정 스케줄 테이블 생성
CREATE TABLE inspection_schedule (
    id UUID PRIMARY KEY,
    scheduled_at TIMESTAMPTZ NOT NULL,
    title VARCHAR(120),
    notes TEXT,
    status VARCHAR(16) NOT NULL DEFAULT 'SCHEDULED',
    completed_at TIMESTAMPTZ,
    inspection_session_id UUID REFERENCES inspection_session (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inspection_schedule_scheduled_at ON inspection_schedule (scheduled_at);
CREATE INDEX idx_inspection_schedule_status ON inspection_schedule (status);
