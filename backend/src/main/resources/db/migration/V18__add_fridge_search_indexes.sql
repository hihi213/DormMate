-- 목적: 냉장고 검색 시 다자릿 슬롯 코드와 호실·보관자 키워드 조회 성능을 향상시키기 위한 보조 인덱스 추가
-- 근거: admin 포장 검색이 room_assignment 및 room 테이블에 대한 LIKE 검색을 수행하며, released_at=IS NULL 조건과 lower(room_number) 비교가 빈번함

CREATE INDEX IF NOT EXISTS idx_room_assignment_user_released
    ON room_assignment (dorm_user_id, released_at);

CREATE INDEX IF NOT EXISTS idx_room_room_number_lower
    ON room (LOWER(room_number));
