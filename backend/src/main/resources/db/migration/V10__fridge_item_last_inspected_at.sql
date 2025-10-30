-- 냉장고 물품 검사 추적 필드 재정비
-- 목적: updated_after_inspection 플래그를 제거하고 마지막 검사 시점을 기록

ALTER TABLE fridge_item
    ADD COLUMN last_inspected_at TIMESTAMPTZ;

ALTER TABLE fridge_item
    DROP COLUMN IF EXISTS updated_after_inspection;

CREATE INDEX IF NOT EXISTS idx_fridge_item_last_inspected_at
    ON fridge_item (last_inspected_at)
    WHERE last_inspected_at IS NOT NULL;
