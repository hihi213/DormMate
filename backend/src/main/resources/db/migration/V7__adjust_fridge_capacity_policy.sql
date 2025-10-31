-- 용량 정책 분리 및 데모용 슬롯 한도 조정
-- 목표:
--   1. 칸 허용량(max_bundle_count)을 라벨 범위를 기준으로 재설정한다.
--   2. 데모 시나리오 설명용으로 2F-R1 슬롯만 허용량을 3으로 제한한다.
--   3. 허용량이 라벨 범위를 넘지 않도록 체크 제약을 추가한다.

SET TIME ZONE 'UTC';

UPDATE fridge_compartment
SET
    max_bundle_count = CASE
        WHEN slot_code = '2F-R1' THEN LEAST(3, label_range_end - label_range_start + 1)
        ELSE label_range_end - label_range_start + 1
    END,
    updated_at = CURRENT_TIMESTAMP
WHERE max_bundle_count <> CASE
        WHEN slot_code = '2F-R1' THEN LEAST(3, label_range_end - label_range_start + 1)
        ELSE label_range_end - label_range_start + 1
    END;

ALTER TABLE fridge_compartment
    DROP CONSTRAINT IF EXISTS ck_fridge_compartment_label_range;

ALTER TABLE fridge_compartment
    ADD CONSTRAINT ck_fridge_compartment_label_range
        CHECK (max_bundle_count <= label_range_end - label_range_start + 1);
