-- ======================================================================
-- V1__init.sql (Unified Latest)
-- 이 파일 하나로 새 DB를 최신 상태로 세팅합니다.
-- ======================================================================

-- 확장
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ENUM 타입 정의
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'machine_type') THEN
    CREATE TYPE machine_type AS ENUM ('WASHER','DRYER');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'item_status') THEN
    CREATE TYPE item_status AS ENUM ('STORED','DISCARDED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_status') THEN
    CREATE TYPE session_status AS ENUM ('RUNNING','COMPLETED','CANCELED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'book_status') THEN
    CREATE TYPE book_status AS ENUM ('AVAILABLE','ON_LOAN','RESERVED','LOST');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reservation_status') THEN
    CREATE TYPE reservation_status AS ENUM ('RESERVED','CANCELED','COMPLETED','NO_SHOW');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
    CREATE TYPE report_status AS ENUM ('REPORTED','CONFIRMED','RESOLVED');
  END IF;
END$$;

-- updated_at 자동 갱신 트리거 함수
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;$$ LANGUAGE plpgsql;

-- ======================================================================
-- Ⅰ. 마스터 데이터
-- ======================================================================

CREATE TABLE dorm_rooms (
  dorm_room_id bigserial PRIMARY KEY,
  room_number  integer NOT NULL,
  floor        integer NOT NULL,
  capacity     integer NOT NULL DEFAULT 1,
  is_active    boolean NOT NULL DEFAULT true,
  CONSTRAINT uk_room_number UNIQUE (room_number)
);

CREATE TABLE roles (
  role_id     bigserial PRIMARY KEY,
  role_name   varchar(50) NOT NULL UNIQUE,
  description varchar(255)
);

CREATE TABLE machine_statuses (
  status_id   bigserial PRIMARY KEY,
  status_code varchar(50) NOT NULL UNIQUE,
  description varchar(255)
);

CREATE TABLE notification_types (
  type_code            varchar(50) PRIMARY KEY,
  description          varchar(255) NOT NULL,
  is_user_configurable boolean NOT NULL DEFAULT true
);

-- ======================================================================
-- Ⅱ. 코어 & 사용자
-- ======================================================================

CREATE TABLE users (
  user_id         bigserial PRIMARY KEY,
  dorm_room_id    bigint NULL REFERENCES dorm_rooms(dorm_room_id) ON DELETE SET NULL,
  personal_number integer NULL, -- 방 미배정이면 NULL 허용
  username        citext NOT NULL UNIQUE,
  password_hash   text NOT NULL,
  email           citext NOT NULL UNIQUE,
  role_id         bigint NOT NULL REFERENCES roles(role_id),
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- 방이 지정된 경우에만 개인번호 유니크 강제 (부분 유니크 인덱스)
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_room_person_assigned
  ON users(dorm_room_id, personal_number)
  WHERE dorm_room_id IS NOT NULL AND personal_number IS NOT NULL;
-- 방별 사용자 조회 보조 인덱스
CREATE INDEX IF NOT EXISTS ix_users_dorm_room ON users(dorm_room_id);

-- ======================================================================
-- Ⅲ. 자원 상세 & 접근 제어
-- ======================================================================

-- 냉장고
CREATE TABLE refrigerators (
  refrigerator_id bigserial PRIMARY KEY,
  name            varchar(100) NOT NULL,
  location        varchar(255) NOT NULL,
  is_active       boolean NOT NULL DEFAULT true
);

CREATE TABLE compartments (
  compartment_id  bigserial PRIMARY KEY,
  refrigerator_id bigint NOT NULL REFERENCES refrigerators(refrigerator_id),
  label           varchar(50) NOT NULL,
  type            varchar(16) NOT NULL CHECK (type IN ('REFRIGERATED','FREEZER')),
  CONSTRAINT uk_compartment_per_fridge UNIQUE (refrigerator_id, label)
);
CREATE INDEX IF NOT EXISTS ix_compartments_refrigerator_id ON compartments(refrigerator_id);

CREATE TABLE compartment_access_rules (
  rule_id            bigserial PRIMARY KEY,
  compartment_id     bigint NOT NULL REFERENCES compartments(compartment_id) ON DELETE CASCADE,
  start_room_number  integer NOT NULL,
  end_room_number    integer NOT NULL,
  room_range         int4range GENERATED ALWAYS AS (int4range(start_room_number, end_room_number, '[]')) STORED,
  CHECK (end_room_number >= start_room_number)
);
CREATE INDEX IF NOT EXISTS ix_compartment_access_compartment_id ON compartment_access_rules(compartment_id);
CREATE INDEX IF NOT EXISTS ix_compartment_access_room_range ON compartment_access_rules(start_room_number, end_room_number);
ALTER TABLE compartment_access_rules
  ADD CONSTRAINT no_overlap_compartment_access
  EXCLUDE USING gist (
    compartment_id WITH =,
    room_range     WITH &&
  );

CREATE TABLE bundles (
  bundle_id      bigserial PRIMARY KEY,
  user_id        bigint NOT NULL REFERENCES users(user_id),
  compartment_id bigint NOT NULL REFERENCES compartments(compartment_id),
  bundle_name    varchar(100) NOT NULL,
  memo           text,
  registered_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_bundles_user_id ON bundles(user_id);
CREATE INDEX IF NOT EXISTS ix_bundles_compartment_id ON bundles(compartment_id);

CREATE TABLE items (
  item_id        bigserial PRIMARY KEY,
  bundle_id      bigint NOT NULL REFERENCES bundles(bundle_id) ON DELETE CASCADE,
  item_name      varchar(100) NOT NULL,
  expiry_date    date,
  status         item_status NOT NULL DEFAULT 'STORED',
  discarded_at   timestamptz NULL,
  discard_reason varchar(255) NULL
);
CREATE INDEX IF NOT EXISTS ix_items_bundle_id ON items(bundle_id);
CREATE INDEX IF NOT EXISTS ix_items_expiry_date ON items(expiry_date);

-- 세탁 시설
CREATE TABLE laundry_rooms (
  laundry_room_id bigserial PRIMARY KEY,
  name            varchar(100) NOT NULL,
  location        varchar(255) NOT NULL
);

CREATE TABLE laundry_machines (
  machine_id         bigserial PRIMARY KEY,
  laundry_room_id    bigint NOT NULL REFERENCES laundry_rooms(laundry_room_id),
  name               varchar(100) NOT NULL,
  type               machine_type NOT NULL,
  status_id          bigint NOT NULL REFERENCES machine_statuses(status_id),
  end_time           timestamptz NULL,
  current_session_id bigint NULL,
  CONSTRAINT uk_machine_per_room UNIQUE (laundry_room_id, name)
);
CREATE INDEX IF NOT EXISTS ix_laundry_machines_room_id ON laundry_machines(laundry_room_id);
CREATE INDEX IF NOT EXISTS ix_laundry_machines_status_id ON laundry_machines(status_id);
CREATE INDEX IF NOT EXISTS ix_lm_room_status ON laundry_machines(laundry_room_id, status_id);

CREATE TABLE laundry_machine_access_rules (
  rule_id            bigserial PRIMARY KEY,
  machine_id         bigint NOT NULL REFERENCES laundry_machines(machine_id) ON DELETE CASCADE,
  start_room_number  integer NOT NULL,
  end_room_number    integer NOT NULL,
  room_range         int4range GENERATED ALWAYS AS (int4range(start_room_number, end_room_number, '[]')) STORED,
  CHECK (end_room_number >= start_room_number)
);
CREATE INDEX IF NOT EXISTS ix_machine_access_machine_id ON laundry_machine_access_rules(machine_id);
CREATE INDEX IF NOT EXISTS ix_machine_access_room_range ON laundry_machine_access_rules(start_room_number, end_room_number);
ALTER TABLE laundry_machine_access_rules
  ADD CONSTRAINT no_overlap_machine_access
  EXCLUDE USING gist (
    machine_id WITH =,
    room_range WITH &&
  );

CREATE TABLE user_laundry_settings (
  setting_id  bigserial PRIMARY KEY,
  user_id     bigint NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  preset_name varchar(50) NOT NULL,
  minutes     integer NOT NULL,
  CONSTRAINT uk_user_preset UNIQUE (user_id, preset_name)
);

-- ======================================================================
-- Ⅳ. 기록/알림/설정
-- ======================================================================

-- 세탁기 세션
CREATE TABLE machine_usage_log (
  session_id      bigserial PRIMARY KEY,
  machine_id      bigint NOT NULL REFERENCES laundry_machines(machine_id),
  user_id         bigint NULL REFERENCES users(user_id) ON DELETE SET NULL,
  proxy_user_id   bigint NULL REFERENCES users(user_id) ON DELETE SET NULL,
  start_time      timestamptz NOT NULL,
  end_time        timestamptz NOT NULL,
  actual_end_time timestamptz NULL,
  status          session_status NOT NULL DEFAULT 'RUNNING',
  CHECK (end_time > start_time),
  CHECK (actual_end_time IS NULL OR actual_end_time >= start_time),
  CHECK ((status = 'COMPLETED' AND actual_end_time IS NOT NULL) OR (status <> 'COMPLETED' AND actual_end_time IS NULL))
);
CREATE INDEX IF NOT EXISTS ix_mul_machine_id ON machine_usage_log(machine_id);
CREATE INDEX IF NOT EXISTS ix_mul_user_id    ON machine_usage_log(user_id);
CREATE INDEX IF NOT EXISTS ix_mul_proxy_id   ON machine_usage_log(proxy_user_id);
-- 동시 RUNNING 세션 1개 제한(부분 유니크)
CREATE UNIQUE INDEX IF NOT EXISTS ux_running_per_machine
  ON machine_usage_log(machine_id)
  WHERE status = 'RUNNING';
-- 곧 끝나는 세션 조회 최적화
CREATE INDEX IF NOT EXISTS ix_running_end_time
  ON machine_usage_log(end_time)
  WHERE status = 'RUNNING';
-- 사용자 본인 RUNNING 세션 빠른 조회
CREATE INDEX IF NOT EXISTS ix_mul_user_running
  ON machine_usage_log(user_id)
  WHERE status = 'RUNNING';

-- FK + 트리거: current_session_id 무결성 (RUNNING + 같은 기기)
ALTER TABLE laundry_machines
  ADD CONSTRAINT fk_current_session_id
  FOREIGN KEY (current_session_id)
  REFERENCES machine_usage_log(session_id)
  ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION enforce_current_session_machine_match()
RETURNS trigger AS $$
DECLARE
  sid_machine bigint;
  sid_status  session_status;
BEGIN
  IF NEW.current_session_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT machine_id, status
    INTO sid_machine, sid_status
  FROM machine_usage_log
  WHERE session_id = NEW.current_session_id;

  IF sid_machine IS NULL OR sid_machine <> NEW.machine_id THEN
    RAISE EXCEPTION 'current_session_id % does not belong to machine %',
      NEW.current_session_id, NEW.machine_id;
  END IF;
  IF sid_status IS DISTINCT FROM 'RUNNING' THEN
    RAISE EXCEPTION 'current_session_id % is not RUNNING (actual=%)',
      NEW.current_session_id, sid_status;
  END IF;
  RETURN NEW;
END;$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_machine_current_session ON laundry_machines;
CREATE TRIGGER trg_machine_current_session
BEFORE INSERT OR UPDATE OF current_session_id, machine_id
ON laundry_machines
FOR EACH ROW EXECUTE FUNCTION enforce_current_session_machine_match();

-- 세션 상호작용
CREATE TABLE session_interactions (
  interaction_id   bigserial PRIMARY KEY,
  session_id       bigint NOT NULL REFERENCES machine_usage_log(session_id) ON DELETE CASCADE,
  actor_user_id    bigint NOT NULL REFERENCES users(user_id),
  interaction_type varchar(50) NOT NULL,
  details          jsonb,
  is_read          boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_session_interactions_session_id ON session_interactions(session_id);
CREATE INDEX IF NOT EXISTS ix_session_interactions_actor_id   ON session_interactions(actor_user_id);
CREATE INDEX IF NOT EXISTS ix_session_interactions_details_gin ON session_interactions USING gin (details);

-- 도서
CREATE TABLE books (
  book_id        bigserial PRIMARY KEY,
  title          varchar(255) NOT NULL,
  author         varchar(100) NOT NULL,
  publisher      varchar(100),
  published_year integer,
  status         book_status NOT NULL DEFAULT 'AVAILABLE'
);
CREATE INDEX IF NOT EXISTS ix_books_title  ON books(title);
CREATE INDEX IF NOT EXISTS ix_books_author ON books(author);
CREATE INDEX IF NOT EXISTS ix_books_status ON books(status);

-- 도서 대출
CREATE TABLE book_loans (
  loan_id         bigserial PRIMARY KEY,
  book_id         bigint NOT NULL REFERENCES books(book_id),
  user_id         bigint NOT NULL REFERENCES users(user_id),
  loan_date       timestamptz NOT NULL DEFAULT now(),
  due_date        timestamptz NOT NULL,
  return_date     timestamptz NULL,
  extension_count integer NOT NULL DEFAULT 0,
  CHECK (due_date > loan_date)
);
CREATE INDEX IF NOT EXISTS ix_book_loans_book_id     ON book_loans(book_id);
CREATE INDEX IF NOT EXISTS ix_book_loans_user_id     ON book_loans(user_id);
CREATE INDEX IF NOT EXISTS ix_book_loans_return_date ON book_loans(return_date);
-- 같은 책 미반납 상태 중복 대출 금지
CREATE UNIQUE INDEX IF NOT EXISTS ux_book_on_loan
  ON book_loans(book_id)
  WHERE return_date IS NULL;

-- 스터디룸

CREATE TABLE study_rooms (
  study_room_id bigserial PRIMARY KEY,
  name          varchar(100) NOT NULL,
  location      varchar(255) NOT NULL,
  capacity      integer NOT NULL DEFAULT 4,
  is_active     boolean NOT NULL DEFAULT true
);

CREATE TABLE study_room_reservations (
  reservation_id bigserial PRIMARY KEY,
  study_room_id  bigint NOT NULL REFERENCES study_rooms(study_room_id),
  user_id        bigint NOT NULL REFERENCES users(user_id),
  start_time     timestamptz NOT NULL,
  end_time       timestamptz NOT NULL,
  status         reservation_status NOT NULL DEFAULT 'RESERVED',
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS ix_srr_room_id ON study_room_reservations(study_room_id);
CREATE INDEX IF NOT EXISTS ix_srr_user_id ON study_room_reservations(user_id);
CREATE INDEX IF NOT EXISTS ix_srr_time    ON study_room_reservations(start_time, end_time);
ALTER TABLE study_room_reservations
  ADD CONSTRAINT srr_no_overlap
  EXCLUDE USING gist (
    study_room_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  )
  WHERE (status = 'RESERVED');
-- 앞으로 시작하는 예약 조회 최적화 (now() 함수 제거)
CREATE INDEX IF NOT EXISTS ix_srr_upcoming
  ON study_room_reservations(start_time)
  WHERE status = 'RESERVED';

-- 포인트
CREATE TABLE points_log (
  point_id  bigserial PRIMARY KEY,
  user_id   bigint NOT NULL REFERENCES users(user_id),
  issuer_id bigint NOT NULL REFERENCES users(user_id),
  points    integer NOT NULL,
  reason    varchar(255) NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_points_user_id   ON points_log(user_id);
CREATE INDEX IF NOT EXISTS ix_points_issuer_id ON points_log(issuer_id);

-- 기기 보고
CREATE TABLE machine_reports (
  report_id   bigserial PRIMARY KEY,
  machine_id  bigint NOT NULL REFERENCES laundry_machines(machine_id),
  reporter_id bigint NOT NULL REFERENCES users(user_id),
  reason      text NOT NULL,
  status      report_status NOT NULL DEFAULT 'REPORTED',
  reported_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_reports_machine_id  ON machine_reports(machine_id);
CREATE INDEX IF NOT EXISTS ix_reports_reporter_id ON machine_reports(reporter_id);

-- 활동 로그
CREATE TABLE activity_logs (
  log_id      bigserial PRIMARY KEY,
  user_id     bigint NULL REFERENCES users(user_id) ON DELETE SET NULL,
  action_type varchar(100) NOT NULL,
  details     jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_activity_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS ix_activity_action  ON activity_logs(action_type);

-- 알림
CREATE TABLE notifications (
  notification_id        bigserial PRIMARY KEY,
  recipient_id           bigint NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  content                text NOT NULL,
  is_read                boolean NOT NULL DEFAULT false,
  notification_type_code varchar(50) NOT NULL REFERENCES notification_types(type_code),
  related_entity_type    varchar(50),
  related_entity_id      bigint,
  created_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_notifications_recipient_read ON notifications(recipient_id, is_read);
CREATE INDEX IF NOT EXISTS ix_notifications_type           ON notifications(notification_type_code);
CREATE INDEX IF NOT EXISTS ix_notifications_user_read_created ON notifications(recipient_id, is_read, created_at DESC);

CREATE TABLE user_notification_settings (
  user_id                bigint NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  notification_type_code varchar(50) NOT NULL REFERENCES notification_types(type_code) ON DELETE CASCADE,
  is_enabled             boolean NOT NULL DEFAULT true,
  PRIMARY KEY (user_id, notification_type_code)
);

-- 시스템 설정
CREATE TABLE system_settings (
  setting_key   varchar(100) PRIMARY KEY,
  setting_value varchar(255) NOT NULL
);

-- 통계(요약)
CREATE TABLE user_stats (
  user_id         bigint NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  stat_month      varchar(7) NOT NULL,  -- 'YYYY-MM'
  laundry_count   integer NOT NULL DEFAULT 0,
  study_minutes   integer NOT NULL DEFAULT 0,
  book_loan_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, stat_month)
);

-- 접근 규칙 (도서/스터디룸)
CREATE TABLE book_access_rules (
  rule_id           bigserial PRIMARY KEY,
  book_id           bigint NULL REFERENCES books(book_id) ON DELETE CASCADE,
  start_room_number integer NOT NULL,
  end_room_number   integer NOT NULL,
  room_range        int4range GENERATED ALWAYS AS (int4range(start_room_number, end_room_number, '[]')) STORED,
  CHECK (end_room_number >= start_room_number)
);
CREATE INDEX IF NOT EXISTS ix_book_access_book_id ON book_access_rules(book_id);
CREATE INDEX IF NOT EXISTS ix_book_access_range   ON book_access_rules(start_room_number, end_room_number);
ALTER TABLE book_access_rules
  ADD CONSTRAINT no_overlap_book_access
  EXCLUDE USING gist (
    (COALESCE(book_id, -1)) WITH =,
    room_range WITH &&
  );

CREATE TABLE study_room_access_rules (
  rule_id           bigserial PRIMARY KEY,
  study_room_id     bigint NOT NULL REFERENCES study_rooms(study_room_id) ON DELETE CASCADE,
  start_room_number integer NOT NULL,
  end_room_number   integer NOT NULL,
  room_range        int4range GENERATED ALWAYS AS (int4range(start_room_number, end_room_number, '[]')) STORED,
  CHECK (end_room_number >= start_room_number)
);
CREATE INDEX IF NOT EXISTS ix_sr_access_room_id ON study_room_access_rules(study_room_id);
CREATE INDEX IF NOT EXISTS ix_sr_access_range   ON study_room_access_rules(start_room_number, end_room_number);
ALTER TABLE study_room_access_rules
  ADD CONSTRAINT no_overlap_study_room_access
  EXCLUDE USING gist (
    study_room_id WITH =,
    room_range    WITH &&
  );

-- 도서 가용성 뷰 (loan 상태 기반)
CREATE OR REPLACE VIEW books_with_availability AS
SELECT b.*,
       NOT EXISTS (
         SELECT 1 FROM book_loans bl
         WHERE bl.book_id = b.book_id AND bl.return_date IS NULL
       ) AS is_available
FROM books b;
