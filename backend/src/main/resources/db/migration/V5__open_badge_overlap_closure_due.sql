
-- V5__open_badge_overlap_closure_due.sql
-- 목적:
--  1) (요청) 책/스터디룸 접근성 테이블 제거 (완전 개방 정책 반영)
--  2) (요청) 스터디룸 '같이공부해요' 배지 토글 컬럼 추가(+ 인덱스)
--  3) (요청) 사용자 단위 예약 겹침 금지 (EXCLUDE, status='RESERVED')
--  4) (요청) 휴관(closure_windows)과 예약/대출의 충돌 차단
--  5) (요청) 도서 대출 due_date 자동 설정 & 상한(MAX_BOOK_LOAN_DAYS) 검증
--
-- 안전성:
--  - IF EXISTS / IF NOT EXISTS 사용
--  - DEFERRABLE INITIALLY DEFERRED 트리거로 동시성/경합에 안전
--  - 트랜잭션으로 감쌈

BEGIN;

-- ======================================================================
-- 0) GiST에서 '=' 지원을 위해 btree_gist 확장 (이미 있을 수 있음)
-- ======================================================================
DO $$
BEGIN
  PERFORM 1 FROM pg_extension WHERE extname='btree_gist';
  IF NOT FOUND THEN
    CREATE EXTENSION btree_gist;
  END IF;
END$$;

-- ======================================================================
-- 1) 책/스터디룸 접근성 스키마 제거 (완전 개방)
--    - 과거 제안 트리거/함수가 있다면 안전하게 DROP
-- ======================================================================

-- (1-1) 접근성 트리거/함수 제거 (존재 시)
DROP TRIGGER IF EXISTS ctrg_book_loan_access ON book_loans;
DROP FUNCTION IF EXISTS enforce_book_loan_access();

DROP TRIGGER IF EXISTS ctrg_srr_access ON study_room_reservations;
DROP FUNCTION IF EXISTS enforce_study_reservation_access();

-- (1-2) 접근성 규칙 테이블 제거
DROP TABLE IF EXISTS book_access_rules CASCADE;
DROP TABLE IF EXISTS study_room_access_rules CASCADE;

-- ======================================================================
-- 2) 스터디룸 '같이공부해요' 배지 토글
-- ======================================================================
ALTER TABLE study_room_reservations
  ADD COLUMN IF NOT EXISTS open_study_badge boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS open_study_note  varchar(120);

-- 조회 최적화: 현재/다가오는 배지 켠 예약 탐색
CREATE INDEX IF NOT EXISTS ix_srr_badge_now
ON study_room_reservations (open_study_badge, start_time, end_time)
WHERE status='RESERVED' AND open_study_badge = true;

-- ======================================================================
-- 3) 사용자 단위 예약 겹침 금지 (같은 시간대 중복 예약 막기)
--    - 방 단위 EXCLUDE는 이미 존재(V1). 여기에 'user_id' 기준도 추가.
--    - 상태가 RESERVED일 때만 적용.
-- ======================================================================
-- 사용자 단위 예약 겹침 금지 제약조건 추가 (기존 제약조건이 있으면 제거 후 재생성)
ALTER TABLE study_room_reservations DROP CONSTRAINT IF EXISTS srr_no_user_overlap;
ALTER TABLE study_room_reservations
  ADD CONSTRAINT srr_no_user_overlap
  EXCLUDE USING gist (
    user_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  )
  WHERE (status = 'RESERVED');

-- ======================================================================
-- 4) 휴관과의 충돌 차단
--    - 스터디룸 예약: 시간대가 활성 휴관창과 겹치면 차단
--    - 도서 대출: loan_date가 휴관창 안이면 차단(정책 단순화)
-- ======================================================================
CREATE OR REPLACE FUNCTION block_when_closure()
RETURNS trigger AS $$
DECLARE v_hit boolean;
BEGIN
  IF TG_TABLE_NAME = 'study_room_reservations' THEN
    SELECT TRUE INTO v_hit
    FROM closure_windows cw
    WHERE cw.is_active
      AND tstzrange(NEW.start_time, NEW.end_time, '[)')
          && tstzrange(cw.starts_at, cw.ends_at, '[)')
    LIMIT 1;
    IF v_hit THEN
      RAISE EXCEPTION 'Reservation overlaps with closure window';
    END IF;
    RETURN NEW;
  ELSIF TG_TABLE_NAME = 'book_loans' THEN
    IF EXISTS (
      SELECT 1 FROM closure_windows cw
      WHERE cw.is_active
        AND NEW.loan_date >= cw.starts_at
        AND NEW.loan_date <  cw.ends_at
      LIMIT 1
    ) THEN
      RAISE EXCEPTION 'Loan date is within a closure window';
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ctrg_srr_closure ON study_room_reservations;
CREATE CONSTRAINT TRIGGER ctrg_srr_closure
AFTER INSERT OR UPDATE OF start_time, end_time, status
ON study_room_reservations
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION block_when_closure();

DROP TRIGGER IF EXISTS ctrg_book_closure ON book_loans;
CREATE CONSTRAINT TRIGGER ctrg_book_closure
AFTER INSERT OR UPDATE OF loan_date
ON book_loans
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION block_when_closure();

-- ======================================================================
-- 5) 도서 대출: due_date 자동 설정 & 상한 검증
--    - MAX_BOOK_LOAN_DAYS (system_settings) 사용, 없으면 14일
-- ======================================================================
CREATE OR REPLACE FUNCTION apply_due_date_policy()
RETURNS trigger AS $$
DECLARE v_days int;
BEGIN
  SELECT setting_value::int INTO v_days
  FROM system_settings WHERE setting_key='MAX_BOOK_LOAN_DAYS';
  IF v_days IS NULL THEN v_days := 14; END IF;

  IF NEW.due_date IS NULL THEN
    NEW.due_date := NEW.loan_date + (v_days || ' days')::interval;
  END IF;

  IF NEW.due_date <= NEW.loan_date THEN
    RAISE EXCEPTION 'due_date must be after loan_date';
  END IF;

  IF NEW.due_date > NEW.loan_date + (v_days || ' days')::interval THEN
    RAISE EXCEPTION 'due_date exceeds MAX_BOOK_LOAN_DAYS(%)', v_days;
  END IF;

  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_book_due_date_policy ON book_loans;
CREATE TRIGGER trg_book_due_date_policy
BEFORE INSERT OR UPDATE OF loan_date, due_date
ON book_loans
FOR EACH ROW EXECUTE FUNCTION apply_due_date_policy();

COMMIT;
