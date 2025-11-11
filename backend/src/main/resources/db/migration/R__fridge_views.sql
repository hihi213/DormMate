-- 냉장고 번들/방 권한 진단용 뷰
-- 목적: 번들 소유자 ↔ 방 배정 ↔ compartment 접근 권한이 불일치하는 케이스를 빠르게 조회
-- 사용 예시: SELECT * FROM vw_fridge_bundle_owner_mismatch LIMIT 20;

CREATE OR REPLACE VIEW vw_fridge_bundle_owner_mismatch AS
SELECT
    fb.id                     AS bundle_id,
    fb.bundle_name,
    fb.label_number,
    fb.owner_user_id,
    du.full_name              AS owner_name,
    du.login_id               AS owner_login_id,
    ra.room_id,
    r.room_number,
    r.floor                   AS room_floor,
    ra.personal_no,
    fb.fridge_compartment_id,
    fc.slot_index,
    fc.compartment_type,
    fu.floor_no               AS fridge_floor_no,
    fu.display_name           AS fridge_display_name,
    CASE
        WHEN ra.id IS NULL  THEN 'NO_ACTIVE_ROOM_ASSIGNMENT'
        WHEN cra.id IS NULL THEN 'ROOM_NOT_ALLOWED_FOR_COMPARTMENT'
        ELSE 'UNKNOWN'
    END                      AS issue_type,
    fb.created_at,
    fb.updated_at
FROM fridge_bundle fb
JOIN dorm_user du ON du.id = fb.owner_user_id
LEFT JOIN room_assignment ra
       ON ra.dorm_user_id = fb.owner_user_id
      AND ra.released_at IS NULL
LEFT JOIN room r ON r.id = ra.room_id
JOIN fridge_compartment fc ON fc.id = fb.fridge_compartment_id
JOIN fridge_unit fu ON fu.id = fc.fridge_unit_id
LEFT JOIN compartment_room_access cra
       ON cra.fridge_compartment_id = fb.fridge_compartment_id
      AND cra.room_id = ra.room_id
      AND cra.released_at IS NULL
WHERE fb.status = 'ACTIVE'
  AND fb.deleted_at IS NULL
  AND (ra.id IS NULL OR cra.id IS NULL);
