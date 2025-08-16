-- ======================================================================
-- R__seed_master_data.sql
-- DormMate 기본 마스터 데이터 시드
-- 항상 마지막에 실행: 버전 관리 파일(V 파일)들이 모두 실행된 후 마지막에 실행됩니다.
-- 개발 환경을 새로 구축할 때마다 이 스크립트가 실행되어 필요한 기본 데이터가 항상 DB에 존재하도록 보장해 줍니다.
-- ======================================================================

-- 1) Roles
INSERT INTO roles (role_name, description) VALUES
  ('ADMIN',   '시스템 관리자'),
  ('STAFF',   '기숙사 운영 담당자'),
  ('STUDENT', '일반 입주자')
ON CONFLICT (role_name) DO UPDATE
SET description = EXCLUDED.description;

-- 2) Machine Statuses
INSERT INTO machine_statuses (status_code, description) VALUES
  ('AVAILABLE',    '사용 가능'),
  ('IN_USE',       '사용 중'),
  ('OUT_OF_ORDER', '고장'),
  ('MAINTENANCE',  '점검 중')
ON CONFLICT (status_code) DO UPDATE
SET description = EXCLUDED.description;

-- 3) Notification Types
INSERT INTO notification_types (type_code, description, is_user_configurable) VALUES
  ('MACHINE_DONE',         '세탁/건조 완료 알림',            true),
  ('LAUNDRY_ENDING_SOON',  '세탁 종료 임박 알림',            true),
  ('MACHINE_REPORTED',     '기기 고장 신고 접수',            true),
  ('BOOK_DUE',             '도서 반납 예정 알림',            true),
  ('STUDY_RESERVATION_REM','스터디룸 예약 리마인더',         true),
  ('SYSTEM_ALERT',         '시스템 공지',                    false)
ON CONFLICT (type_code) DO UPDATE
SET description = EXCLUDED.description,
    is_user_configurable = EXCLUDED.is_user_configurable;

-- 4) Permissions (세분 권한)
INSERT INTO permissions(permission_code, description) VALUES
 ('ADMIN_ALL','모든 관리자 기능'),
 ('MANAGE_USERS','사용자 관리'),
 ('MANAGE_REFRIGERATORS','냉장고/칸 관리'),
 ('ASSIGN_SUPERVISORS','냉장고 검사자 배정'),
 ('MANAGE_LAUNDRY','세탁실/기기 관리'),
 ('OVERRIDE_ACCESS','자원 접근 예외 부여/차단'),
 ('MANAGE_BOOKS','도서 관리'),
 ('MANAGE_STUDY_ROOMS','스터디룸 관리'),
 ('FORCE_RESERVATION','예약 강제 생성'),
 ('MANAGE_POINTS','상/벌점 관리'),
 ('VIEW_AUDIT','감사/로그 열람'),
 ('MANAGE_CLOSURE','휴관 설정/해제')
ON CONFLICT (permission_code) DO UPDATE
SET description = EXCLUDED.description;

-- 5) Role ↔ Permission 기본 매핑
--  - role_name을 기준으로 role_id를 조회해 매핑합니다.
--  - ON CONFLICT로 중복 매핑 방지.
WITH rp(role_name, permission_code) AS (
  VALUES
    ('ADMIN','ADMIN_ALL'),
    ('ADMIN','VIEW_AUDIT'),
    ('ADMIN','MANAGE_CLOSURE'),
    ('STAFF','VIEW_AUDIT'),
    ('STAFF','MANAGE_REFRIGERATORS'),
    ('STAFF','MANAGE_LAUNDRY'),
    ('STAFF','MANAGE_BOOKS'),
    ('STAFF','MANAGE_STUDY_ROOMS'),
    ('STAFF','MANAGE_POINTS')
)
INSERT INTO role_permissions(role_id, permission_code)
SELECT r.role_id, p.permission_code
FROM rp
JOIN roles r ON r.role_name = rp.role_name
JOIN permissions p ON p.permission_code = rp.permission_code
ON CONFLICT DO NOTHING;

-- 6) System Settings (기본값)
INSERT INTO system_settings (setting_key, setting_value) VALUES
  ('DEFAULT_LAUNDRY_DURATION', '60'),
  ('MAX_BOOK_LOAN_DAYS',       '14')
ON CONFLICT (setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value;

-- (옵션) 개발/로컬 환경 전용 시드 예시
--   - Flyway placeholder: env를 build 시 주입하여 분기 가능
--   - 예: flyway -placeholders.env=dev
-- DO $$
-- BEGIN
--   IF 'dev' IN ('dev', 'local') THEN
--     -- 예: 데모 관리자 계정 더미 삽입 (실운영 금지)
--     -- INSERT INTO users(username, password_hash, email, role_id, is_active)
--     -- SELECT 'admin_demo', '***hash***', 'admin@local', r.role_id, true
--     -- FROM roles r WHERE r.role_name='ADMIN'
--     -- ON CONFLICT DO NOTHING;
--   END IF;
-- END$$;
