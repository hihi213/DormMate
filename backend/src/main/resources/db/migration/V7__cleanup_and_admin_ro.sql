-- V7__cleanup_and_admin_ro.sql
-- 목적:
--  1) compartments.type ENUM 보증 + 중복 CHECK 정리
--  2) 읽기 전용 롤(admin_ro) 생성 및 주요 뷰에만 SELECT 권한 부여
-- 적용 전제: V6 이후(뷰: active_closures_now, upcoming_closures, upcoming_reservations_view, overdue_loans_view 존재)

BEGIN;

-- =====================================================================
-- (1) compartments.type ENUM 보증 + 중복 CHECK 제거
-- =====================================================================

-- 0) ENUM 타입 보증 (없으면 생성)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'compartment_type') THEN
    CREATE TYPE compartment_type AS ENUM ('REFRIGERATED','FREEZER');
  END IF;
END$$;

-- 1) 컬럼 타입을 ENUM으로(이미 ENUM이면 스킵)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'compartments'
      AND column_name  = 'type'
      AND udt_name    <> 'compartment_type'
  ) THEN
    ALTER TABLE public.compartments
      ALTER COLUMN type TYPE compartment_type
      USING type::compartment_type;
  END IF;
END$$;

-- 2) 중복 CHECK 제약 제거(대표 이름: compartments_type_check)
ALTER TABLE public.compartments
  DROP CONSTRAINT IF EXISTS compartments_type_check;

-- (선택) 혹시 이름이 다른 유사 CHECK가 남아 있으면 패턴으로 추가 정리
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.compartments'::regclass
      AND contype  = 'c'  -- CHECK
      AND pg_get_constraintdef(oid) ILIKE '%CHECK%'
      AND pg_get_constraintdef(oid) ILIKE '%type%'
      AND pg_get_constraintdef(oid) ILIKE '%REFRIGERATED%'
      AND pg_get_constraintdef(oid) ILIKE '%FREEZER%'
      AND conname <> 'compartments_type_check'
  LOOP
    EXECUTE format('ALTER TABLE public.compartments DROP CONSTRAINT %I', r.conname);
  END LOOP;
END$$;

-- =====================================================================
-- (2) 읽기 전용 롤(admin_ro) 생성 + 뷰에만 SELECT 부여
-- =====================================================================

-- 2-1) 롤 생성 (없으면)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'admin_ro') THEN
    CREATE ROLE admin_ro NOLOGIN;
  END IF;
END$$;

-- 2-2) 스키마 사용 권한
GRANT USAGE ON SCHEMA public TO admin_ro;

-- 2-3) 지정 뷰들에만 SELECT 부여 (존재할 때만 안전하게 GRANT)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='rooms_with_occupancy') THEN
    EXECUTE 'GRANT SELECT ON public.rooms_with_occupancy TO admin_ro';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='active_closures_now') THEN
    EXECUTE 'GRANT SELECT ON public.active_closures_now TO admin_ro';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='upcoming_closures') THEN
    EXECUTE 'GRANT SELECT ON public.upcoming_closures TO admin_ro';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='upcoming_reservations_view') THEN
    EXECUTE 'GRANT SELECT ON public.upcoming_reservations_view TO admin_ro';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='overdue_loans_view') THEN
    EXECUTE 'GRANT SELECT ON public.overdue_loans_view TO admin_ro';
  END IF;
END$$;

-- (옵션) 이후 생성될 새 뷰들에도 자동 부여하고 싶다면(권장 시만 사용):
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO admin_ro;
-- (주의: "TABLES"에는 뷰도 포함됨)

COMMIT;

-- 사용 팁:
--  - 앱의 어드민 DB 유저에 admin_ro 롤을 부여: GRANT admin_ro TO app_admin_user;
--  - 최소권한 원칙: admin_ro는 SELECT만 가능, 테이블 직접 수정 불가
