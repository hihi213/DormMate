-- 냉장고/검사 스키마 리팩터링
-- 목적: slot_index 기반 라벨 관리, 공통 자원 상태 ENUM, UUID 검사 세션 등 최신 모델 반영

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- fridge_unit 조정
ALTER TABLE fridge_unit RENAME COLUMN floor TO floor_no;

ALTER TABLE fridge_unit
    ADD COLUMN display_name VARCHAR(50);

UPDATE fridge_unit
SET display_name = label
WHERE display_name IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_fridge_unit_display_name
    ON fridge_unit (display_name)
    WHERE display_name IS NOT NULL;

ALTER TABLE fridge_unit
    ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN retired_at TIMESTAMPTZ;

ALTER TABLE fridge_unit DROP CONSTRAINT IF EXISTS uq_fridge_unit_floor_label;
ALTER TABLE fridge_unit DROP CONSTRAINT IF EXISTS ck_fridge_unit_cold_type;

ALTER TABLE fridge_unit DROP COLUMN IF EXISTS label;
ALTER TABLE fridge_unit DROP COLUMN IF EXISTS cold_type;
ALTER TABLE fridge_unit DROP COLUMN IF EXISTS description;

-- fridge_compartment 리팩터링
ALTER TABLE fridge_compartment DROP CONSTRAINT IF EXISTS ck_fridge_compartment_type;

ALTER TABLE fridge_compartment ADD COLUMN slot_index INT;
UPDATE fridge_compartment SET slot_index = GREATEST(display_order - 1, 0) WHERE slot_index IS NULL;
ALTER TABLE fridge_compartment ALTER COLUMN slot_index SET NOT NULL;

ALTER TABLE fridge_compartment
    ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN is_locked BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE fridge_compartment ALTER COLUMN max_bundle_count TYPE INTEGER;

UPDATE fridge_compartment SET compartment_type = 'CHILL' WHERE compartment_type = 'REFRIGERATOR';
UPDATE fridge_compartment SET compartment_type = 'FREEZE' WHERE compartment_type = 'FREEZER';

ALTER TABLE fridge_compartment ADD CONSTRAINT ck_fridge_compartment_type CHECK (compartment_type IN ('CHILL', 'FREEZE'));

ALTER TABLE fridge_compartment DROP CONSTRAINT IF EXISTS uq_fridge_compartment_slot_code;
ALTER TABLE fridge_compartment DROP COLUMN IF EXISTS slot_code;

ALTER TABLE fridge_compartment DROP CONSTRAINT IF EXISTS uq_fridge_compartment_display;
ALTER TABLE fridge_compartment DROP COLUMN IF EXISTS display_order;

ALTER TABLE fridge_compartment DROP CONSTRAINT IF EXISTS ck_fridge_compartment_label_range;
ALTER TABLE fridge_compartment DROP COLUMN IF EXISTS label_range_start;
ALTER TABLE fridge_compartment DROP COLUMN IF EXISTS label_range_end;

ALTER TABLE fridge_compartment DROP COLUMN IF EXISTS is_active;

ALTER TABLE fridge_compartment ADD CONSTRAINT uq_fridge_compartment_slot UNIQUE (fridge_unit_id, slot_index);

-- compartment_room_access 단순화
DROP INDEX IF EXISTS uq_compartment_room_active;

ALTER TABLE compartment_room_access DROP COLUMN IF EXISTS priority_order;
ALTER TABLE compartment_room_access DROP COLUMN IF EXISTS updated_at;

CREATE INDEX idx_compartment_room_access_active
    ON compartment_room_access (fridge_compartment_id)
    WHERE released_at IS NULL;

CREATE INDEX idx_compartment_room_access_active_room
    ON compartment_room_access (room_id)
    WHERE released_at IS NULL;

-- bundle_label_sequence 정비
ALTER TABLE bundle_label_sequence RENAME COLUMN next_label TO next_number;
ALTER TABLE bundle_label_sequence ALTER COLUMN next_number TYPE INTEGER;
ALTER TABLE bundle_label_sequence ADD COLUMN recycled_numbers JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE bundle_label_sequence DROP CONSTRAINT IF EXISTS ck_bundle_label_range;
ALTER TABLE bundle_label_sequence ADD CONSTRAINT ck_bundle_label_range CHECK (next_number BETWEEN 1 AND 999);

-- fridge_bundle 구조 조정
DROP INDEX IF EXISTS uq_fridge_bundle_active_label;

ALTER TABLE fridge_bundle ADD COLUMN label_number INT;
UPDATE fridge_bundle SET label_number = label_code::INT;
ALTER TABLE fridge_bundle ALTER COLUMN label_number SET NOT NULL;
ALTER TABLE fridge_bundle DROP COLUMN IF EXISTS label_code;

ALTER TABLE fridge_bundle DROP COLUMN IF EXISTS visibility;

UPDATE fridge_bundle SET status = 'DELETED' WHERE status = 'REMOVED';

ALTER TABLE fridge_bundle DROP CONSTRAINT IF EXISTS ck_fridge_bundle_status;
ALTER TABLE fridge_bundle ADD CONSTRAINT ck_fridge_bundle_status CHECK (status IN ('ACTIVE', 'DELETED'));

CREATE UNIQUE INDEX uq_fridge_bundle_active_label
    ON fridge_bundle (fridge_compartment_id, label_number)
    WHERE status = 'ACTIVE';

-- fridge_item 구조 조정
DROP INDEX IF EXISTS uq_fridge_item_sequence;

ALTER TABLE fridge_item DROP CONSTRAINT IF EXISTS ck_fridge_item_status;
UPDATE fridge_item SET status = 'DELETED' WHERE status = 'REMOVED';

ALTER TABLE fridge_item DROP COLUMN IF EXISTS sequence_no;
ALTER TABLE fridge_item DROP COLUMN IF EXISTS priority;
ALTER TABLE fridge_item DROP COLUMN IF EXISTS last_modified_at;
ALTER TABLE fridge_item DROP COLUMN IF EXISTS last_modified_by;
ALTER TABLE fridge_item DROP COLUMN IF EXISTS memo;

ALTER TABLE fridge_item ADD COLUMN unit_code VARCHAR(16);
UPDATE fridge_item SET unit_code = unit WHERE unit_code IS NULL;
ALTER TABLE fridge_item DROP COLUMN IF EXISTS unit;

ALTER TABLE fridge_item ADD COLUMN expiry_date DATE;
UPDATE fridge_item SET expiry_date = expires_on WHERE expiry_date IS NULL;
ALTER TABLE fridge_item DROP COLUMN IF EXISTS expires_on;

ALTER TABLE fridge_item RENAME COLUMN post_inspection_modified TO updated_after_inspection;

ALTER TABLE fridge_item ADD CONSTRAINT ck_fridge_item_status CHECK (status IN ('ACTIVE', 'DELETED'));
CREATE INDEX idx_fridge_item_expiry_status ON fridge_item (expiry_date, status);

-- inspection_session을 UUID PK로 전환
ALTER TABLE inspection_session ADD COLUMN id_v2 UUID;
UPDATE inspection_session SET id_v2 = gen_random_uuid() WHERE id_v2 IS NULL;
ALTER TABLE inspection_session ALTER COLUMN id_v2 SET NOT NULL;

ALTER TABLE inspection_participant ADD COLUMN inspection_session_id_v2 UUID;
UPDATE inspection_participant ip
SET inspection_session_id_v2 = s.id_v2
FROM inspection_session s
WHERE ip.inspection_session_id = s.id;
ALTER TABLE inspection_participant ALTER COLUMN inspection_session_id_v2 SET NOT NULL;

ALTER TABLE inspection_action ADD COLUMN inspection_session_id_v2 UUID;
UPDATE inspection_action ia
SET inspection_session_id_v2 = s.id_v2
FROM inspection_session s
WHERE ia.inspection_session_id = s.id;
ALTER TABLE inspection_action ALTER COLUMN inspection_session_id_v2 SET NOT NULL;

ALTER TABLE unregistered_item_event ADD COLUMN inspection_session_id_v2 UUID;
UPDATE unregistered_item_event ue
SET inspection_session_id_v2 = s.id_v2
FROM inspection_session s
WHERE ue.inspection_session_id = s.id;
ALTER TABLE unregistered_item_event ALTER COLUMN inspection_session_id_v2 SET NOT NULL;

ALTER TABLE inspection_participant DROP CONSTRAINT IF EXISTS inspection_participant_inspection_session_id_fkey;
ALTER TABLE inspection_action DROP CONSTRAINT IF EXISTS inspection_action_inspection_session_id_fkey;
ALTER TABLE unregistered_item_event DROP CONSTRAINT IF EXISTS unregistered_item_event_inspection_session_id_fkey;

ALTER TABLE inspection_session DROP CONSTRAINT IF EXISTS inspection_session_pkey;
ALTER TABLE inspection_session DROP COLUMN id;
ALTER TABLE inspection_session RENAME COLUMN id_v2 TO id;
ALTER TABLE inspection_session ADD CONSTRAINT inspection_session_pkey PRIMARY KEY (id);
ALTER TABLE inspection_session ALTER COLUMN id SET DEFAULT gen_random_uuid();

DROP SEQUENCE IF EXISTS inspection_session_id_seq;

ALTER TABLE inspection_participant DROP COLUMN inspection_session_id;
ALTER TABLE inspection_participant RENAME COLUMN inspection_session_id_v2 TO inspection_session_id;
ALTER TABLE inspection_participant ADD CONSTRAINT fk_inspection_participant_session FOREIGN KEY (inspection_session_id) REFERENCES inspection_session (id) ON DELETE CASCADE;

CREATE UNIQUE INDEX uq_inspection_participant_active
    ON inspection_participant (inspection_session_id, dorm_user_id)
    WHERE left_at IS NULL;

ALTER TABLE inspection_action DROP COLUMN inspection_session_id;
ALTER TABLE inspection_action RENAME COLUMN inspection_session_id_v2 TO inspection_session_id;
ALTER TABLE inspection_action ADD CONSTRAINT fk_inspection_action_session FOREIGN KEY (inspection_session_id) REFERENCES inspection_session (id) ON DELETE CASCADE;

ALTER TABLE unregistered_item_event DROP COLUMN inspection_session_id;
ALTER TABLE unregistered_item_event RENAME COLUMN inspection_session_id_v2 TO inspection_session_id;
ALTER TABLE unregistered_item_event ADD CONSTRAINT fk_unregistered_item_event_session FOREIGN KEY (inspection_session_id) REFERENCES inspection_session (id) ON DELETE CASCADE;
