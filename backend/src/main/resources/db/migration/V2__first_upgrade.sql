
-- ======================================================================
-- V2__first_upgrade.sql
-- 목적: V1__init 이후 '최종' 스키마로 단일 업그레이드 (단순 버전)
--  - 냉장고별 칸 수 직접 관리(모델/정책 테이블 無)
--  - 종료 전 알림(B안) session_watchers
--  - 냉장고 검사 권한: fridge_supervisors (냉장고 단위 배정)
--  - 권한 세분화: permissions / role_permissions / user_permissions
--  - 자원 접근 예외: access_overrides
--  - 휴관(Closure): closure_windows / closure_action_logs
--  - (옵션) 이불건조기 구분: machine_type에 BLANKET_DRYER 추가
-- ======================================================================

-- 0) (옵션) 이불건조기 타입 확장
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'machine_type' AND e.enumlabel = 'BLANKET_DRYER'
  ) THEN
    ALTER TYPE machine_type ADD VALUE 'BLANKET_DRYER';
  END IF;
END$$;

-- 1) refrigerators: 층/칸 수 컬럼 추가 + 일치 검증 트리거
ALTER TABLE refrigerators
  ADD COLUMN IF NOT EXISTS floor integer,
  ADD COLUMN IF NOT EXISTS refrigerated_slots integer,
  ADD COLUMN IF NOT EXISTS freezer_slots integer,
  ADD COLUMN IF NOT EXISTS layout_updated_at timestamptz NOT NULL DEFAULT now();

-- 기본값 백필: 기존 compartments 개수 → 슬록 수 초기값
WITH c AS (
  SELECT refrigerator_id,
         SUM(CASE WHEN type='REFRIGERATED' THEN 1 ELSE 0 END)::int AS refrigerated_cnt,
         SUM(CASE WHEN type='FREEZER' THEN 1 ELSE 0 END)::int      AS freezer_cnt
  FROM compartments
  GROUP BY refrigerator_id
)
UPDATE refrigerators r
SET refrigerated_slots = COALESCE(c.refrigerated_cnt, r.refrigerated_slots),
    freezer_slots      = COALESCE(c.freezer_cnt,      r.freezer_slots)
FROM c
WHERE r.refrigerator_id = c.refrigerator_id;

UPDATE refrigerators
SET refrigerated_slots = COALESCE(refrigerated_slots, 0),
    freezer_slots      = COALESCE(freezer_slots, 0);

ALTER TABLE refrigerators
  ALTER COLUMN refrigerated_slots SET NOT NULL,
  ALTER COLUMN freezer_slots      SET NOT NULL;

ALTER TABLE refrigerators
  DROP CONSTRAINT IF EXISTS ck_refrigerators_slots_nonneg,
  ADD  CONSTRAINT ck_refrigerators_slots_nonneg
       CHECK (refrigerated_slots >= 0 AND freezer_slots >= 0);

COMMENT ON COLUMN refrigerators.floor              IS '설치 층(선택)';
COMMENT ON COLUMN refrigerators.refrigerated_slots IS '냉장칸 수(냉장고별 직접 지정)';
COMMENT ON COLUMN refrigerators.freezer_slots      IS '냉동칸 수(냉장고별 직접 지정)';
COMMENT ON COLUMN refrigerators.layout_updated_at  IS '칸 수 변경 마지막 시각';

-- (정책 선택 시) 층당 1대 보장: 활성 + floor IS NOT NULL 일 때만
-- CREATE UNIQUE INDEX IF NOT EXISTS ux_refrigerator_per_floor
--   ON refrigerators(floor) WHERE is_active AND floor IS NOT NULL;

-- 칸 수와 compartments 개수 일치 검증(커밋 시)
CREATE OR REPLACE FUNCTION validate_compartments_match_slots()
RETURNS trigger AS $$
DECLARE
  rid       bigint;
  need_ref  integer;
  need_frz  integer;
  have_ref  integer;
  have_frz  integer;
BEGIN
  IF TG_TABLE_NAME = 'refrigerators' THEN
    rid := NEW.refrigerator_id;
  ELSE
    rid := COALESCE(NEW.refrigerator_id, OLD.refrigerator_id);
  END IF;

  SELECT refrigerated_slots, freezer_slots
    INTO need_ref, need_frz
  FROM refrigerators
  WHERE refrigerator_id = rid;

  SELECT COALESCE(SUM((type='REFRIGERATED')::int),0),
         COALESCE(SUM((type='FREEZER')::int),0)
    INTO have_ref, have_frz
  FROM compartments
  WHERE refrigerator_id = rid;

  IF have_ref <> need_ref OR have_frz <> need_frz THEN
    RAISE EXCEPTION 'Refrigerator %: compartments mismatch. have (REF=%, FRZ=%), need (REF=%, FRZ=%)',
      rid, have_ref, have_frz, need_ref, need_frz;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ctrg_validate_compartments_on_refrigerators ON refrigerators;
CREATE CONSTRAINT TRIGGER ctrg_validate_compartments_on_refrigerators
AFTER INSERT OR UPDATE OF refrigerated_slots, freezer_slots
ON refrigerators
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_compartments_match_slots();

DROP TRIGGER IF EXISTS ctrg_validate_compartments_on_compartments ON compartments;
CREATE CONSTRAINT TRIGGER ctrg_validate_compartments_on_compartments
AFTER INSERT OR UPDATE OR DELETE
ON compartments
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_compartments_match_slots();

-- 2) 냉장고 검사 권한: 냉장고 단위 배정
CREATE TABLE IF NOT EXISTS fridge_supervisors (
  supervisor_id    bigserial PRIMARY KEY,
  user_id          bigint      NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  refrigerator_id  bigint      NOT NULL REFERENCES refrigerators(refrigerator_id) ON DELETE CASCADE,
  start_at         timestamptz NOT NULL DEFAULT now(),
  end_at           timestamptz NULL,
  note             varchar(255),
  CONSTRAINT ck_fs_range CHECK (end_at IS NULL OR end_at > start_at)
);
CREATE INDEX IF NOT EXISTS ix_fs_user             ON fridge_supervisors(user_id);
CREATE INDEX IF NOT EXISTS ix_fs_fridge           ON fridge_supervisors(refrigerator_id);
CREATE INDEX IF NOT EXISTS ix_fs_active_by_fridge ON fridge_supervisors(refrigerator_id) WHERE end_at IS NULL;

-- 3) 종료 전 알림 구독(B안)
CREATE TABLE IF NOT EXISTS session_watchers (
  watcher_id             bigserial PRIMARY KEY,
  session_id             bigint NOT NULL REFERENCES machine_usage_log(session_id) ON DELETE CASCADE,
  user_id                bigint NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  notify_offset_minutes  integer NOT NULL DEFAULT 5 CHECK (notify_offset_minutes BETWEEN 1 AND 120),
  created_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ux_session_user UNIQUE (session_id, user_id)
);
CREATE INDEX IF NOT EXISTS ix_sw_session ON session_watchers(session_id);
CREATE INDEX IF NOT EXISTS ix_sw_user    ON session_watchers(user_id);

-- 4) 권한 세분화
CREATE TABLE IF NOT EXISTS permissions (
  permission_code varchar(64) PRIMARY KEY,
  description     varchar(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id         bigint NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
  permission_code varchar(64) NOT NULL REFERENCES permissions(permission_code) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_code)
);

CREATE TABLE IF NOT EXISTS user_permissions (
  user_id         bigint NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  permission_code varchar(64) NOT NULL REFERENCES permissions(permission_code) ON DELETE CASCADE,
  PRIMARY KEY (user_id, permission_code)
);

-- 5) 자원 접근 예외(허용/차단)
CREATE TABLE IF NOT EXISTS access_overrides (
  override_id   bigserial PRIMARY KEY,
  subject_type  varchar(16) NOT NULL CHECK (subject_type IN ('USER','ROLE')),
  subject_id    bigint NOT NULL,
  resource_type varchar(32) NOT NULL CHECK (resource_type IN ('DORM_ROOM','COMPARTMENT','LAUNDRY_ROOM','STUDY_ROOM','BOOK','REFRIGERATOR','LAUNDRY_MACHINE')),
  resource_id   bigint NOT NULL,
  effect        varchar(8)  NOT NULL CHECK (effect IN ('ALLOW','DENY')),
  expires_at    timestamptz NULL,
  note          varchar(255),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_ao_subject  ON access_overrides(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS ix_ao_resource ON access_overrides(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS ix_ao_expires  ON access_overrides(expires_at);

-- 6) 휴관(Closure)
CREATE TABLE IF NOT EXISTS closure_windows (
  closure_id   bigserial PRIMARY KEY,
  starts_at    timestamptz NOT NULL,
  ends_at      timestamptz NOT NULL,
  reset_days_before integer NOT NULL DEFAULT 0 CHECK (reset_days_before BETWEEN 0 AND 14),
  is_active    boolean NOT NULL DEFAULT true,
  note         varchar(255),
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS ix_closure_active ON closure_windows(is_active);

CREATE TABLE IF NOT EXISTS closure_action_logs (
  action_id    bigserial PRIMARY KEY,
  closure_id   bigint NOT NULL REFERENCES closure_windows(closure_id) ON DELETE CASCADE,
  action_type  varchar(32) NOT NULL CHECK (action_type IN ('FREEZE_LOGIN','BULK_DELETE_FRIDGE_ITEMS','RESET_USERS','EXPORT_BACKUP')),
  run_at       timestamptz NOT NULL DEFAULT now(),
  details      jsonb
);
CREATE INDEX IF NOT EXISTS ix_cal_closure ON closure_action_logs(closure_id);
