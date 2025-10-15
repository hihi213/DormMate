-- =========================
-- DormMate 초기 스키마 (PostgreSQL 전용)
-- 목적: 냉장고 관리 MVP 핵심 테이블, 제약, 트리거 정의
-- 정책: UTC 고정, snake_case 명명, ENUM 최소화, JSONB 사용
-- =========================

-- ========================================
-- 1단계: FridgeBundles 수정
-- ========================================

-- memo 칼럼 추가
ALTER TABLE fridge_bundles 
ADD COLUMN memo TEXT;

COMMENT ON COLUMN fridge_bundles.memo IS 
'포장 전체 메모. 자신만 볼수있는 메모 (주의사항 등)';

-- ========================================
-- 2단계: FridgeItems 칼럼 추가
-- ========================================

-- 타임스탬프 추가
ALTER TABLE fridge_items 
ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN modified_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN deleted_at TIMESTAMPTZ;

-- 검사 관련 추가
ALTER TABLE fridge_items
ADD COLUMN last_inspection_action_id BIGINT,
ADD COLUMN modified_after_inspection BOOLEAN NOT NULL DEFAULT FALSE;

-- 외래키 추가
ALTER TABLE fridge_items
ADD CONSTRAINT fk_fridge_items_inspection 
  FOREIGN KEY (last_inspection_action_id) 
  REFERENCES inspection_actions(id) ON DELETE SET NULL;

-- 주석 추가
COMMENT ON COLUMN fridge_items.created_at IS '물품 등록 시각';
COMMENT ON COLUMN fridge_items.modified_at IS '물품 수정 시각 (자동 갱신)';
COMMENT ON COLUMN fridge_items.deleted_at IS '물품 삭제 시각 (소프트 삭제)';
COMMENT ON COLUMN fridge_items.last_inspection_action_id IS '마지막 검사 조치 ID';
COMMENT ON COLUMN fridge_items.modified_after_inspection IS '검사 후 수정 여부';

-- ========================================
-- 3단계: FridgeItems memo 제거
-- ========================================

ALTER TABLE fridge_items 
DROP COLUMN memo;

-- ========================================
-- 4단계: 인덱스 추가
-- ========================================

-- 물품 생성 시각 조회용
CREATE INDEX ix_fridge_items_bundle_created 
  ON fridge_items (bundle_id, created_at DESC);

-- 검사 후 수정 물품 조회용
CREATE INDEX ix_fridge_items_modified_after_inspection 
  ON fridge_items (modified_after_inspection, modified_at DESC) 
  WHERE modified_after_inspection = true;

-- 활성 물품만 조회용 (소프트 삭제 제외)
CREATE INDEX ix_fridge_items_active 
  ON fridge_items (bundle_id, deleted_at) 
  WHERE deleted_at IS NULL;

-- ========================================
-- 5단계: 트리거 생성
-- ========================================

-- modified_at 자동 갱신
CREATE OR REPLACE FUNCTION fn_touch_fridge_items_modified()
RETURNS TRIGGER AS $$
BEGIN
    NEW.modified_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_fridge_items_touch_modified
BEFORE UPDATE ON fridge_items
FOR EACH ROW EXECUTE FUNCTION fn_touch_fridge_items_modified();

-- ========================================
-- 6단계: 사용자 로그인 ID 분리
-- ========================================

ALTER TABLE users
ADD COLUMN login_id CITEXT;

UPDATE users
SET login_id = email;

ALTER TABLE users
ALTER COLUMN login_id SET NOT NULL;

ALTER TABLE users
ADD CONSTRAINT uq_users_login_id UNIQUE (login_id);

ALTER TABLE users
ALTER COLUMN email DROP NOT NULL;

COMMENT ON COLUMN users.login_id IS '로그인용 아이디 (대소문자 구분 없음)';
