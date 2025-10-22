-- DormMate 기본 시드
-- 근거: docs/data-model.md §4.1~§4.2
-- 목적: 역할 코드 및 층/호실 메타데이터를 초기화한다.
-- 정책: 반복 실행 시 안전하도록 ON CONFLICT/UPSERT 사용.

SET TIME ZONE 'UTC';

-- UUID 생성 함수가 없을 경우를 대비해 pgcrypto 확장 활성화
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==========================
-- 역할 코드 초기값
-- ==========================
INSERT INTO role (code, name, description, created_at, updated_at)
VALUES
    ('RESIDENT', '기숙사 거주자', '기본 거주자 권한', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('FLOOR_MANAGER', '층별장', '층별 냉장고 및 검사 담당자', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('ADMIN', '관리자', '시스템 전역 관리자', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (code) DO UPDATE
SET name        = EXCLUDED.name,
    description = EXCLUDED.description,
    updated_at   = CURRENT_TIMESTAMP;

-- ==========================
-- 층/호실 메타데이터
-- ==========================
WITH raw_rooms AS (
    SELECT
        floor,
        LPAD(room_no::text, 2, '0') AS room_number,
        CASE
            WHEN (floor = 2 AND room_no IN (13, 24))
              OR (floor IN (3, 4, 5) AND room_no = 13)
            THEN 1
            ELSE 3
        END AS capacity,
        CASE
            WHEN (floor = 2 AND room_no IN (13, 24))
              OR (floor IN (3, 4, 5) AND room_no = 13)
            THEN 'SINGLE'
            ELSE 'TRIPLE'
        END AS room_type
    FROM generate_series(2, 5) AS floor
    CROSS JOIN generate_series(1, 24) AS room_no
)
INSERT INTO room (id, floor, room_number, room_type, capacity, created_at, updated_at)
SELECT
    gen_random_uuid(),
    floor,
    room_number,
    room_type,
    capacity,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM raw_rooms
ON CONFLICT (floor, room_number) DO UPDATE
SET room_type = EXCLUDED.room_type,
    capacity  = EXCLUDED.capacity,
    updated_at = CURRENT_TIMESTAMP;
