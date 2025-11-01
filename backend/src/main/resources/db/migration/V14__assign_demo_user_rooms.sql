-- 데모 사용자 호실 배정 보정
-- 목적: V5 시드 시점에 room 데이터가 없을 경우 누락된 room_assignment를 다시 채운다.

SET TIME ZONE 'UTC';

DO $$
DECLARE
    rec RECORD;
    target_user_id UUID;
    target_room_id UUID;
BEGIN
    FOR rec IN
        SELECT *
        FROM (VALUES
            ('alice', 2, '05', 1),
            ('bob',   2, '05', 2),
            ('carol', 2, '06', 1),
            ('dylan', 2, '17', 2),
            ('diana', 3, '05', 1),
            ('eric',  3, '13', 1),
            ('fiona', 3, '24', 1)
        ) AS v(login_id, floor_no, room_no, personal_no)
    LOOP
        SELECT id INTO target_user_id FROM dorm_user WHERE login_id = rec.login_id;
        SELECT id INTO target_room_id FROM room WHERE floor = rec.floor_no AND room_number = rec.room_no LIMIT 1;

        IF target_user_id IS NULL OR target_room_id IS NULL THEN
            CONTINUE;
        END IF;

        -- 기존 다른 호실 배정을 해제
        UPDATE room_assignment
        SET released_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE dorm_user_id = target_user_id
          AND released_at IS NULL
          AND room_id <> target_room_id;

        -- 동일 호실 동일 자리의 다른 사용자는 해제
        UPDATE room_assignment
        SET released_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE room_id = target_room_id
          AND personal_no = rec.personal_no
          AND released_at IS NULL
          AND dorm_user_id <> target_user_id;

        BEGIN
            INSERT INTO room_assignment (
                id,
                room_id,
                dorm_user_id,
                personal_no,
                assigned_at,
                released_at,
                created_at,
                updated_at
            )
            VALUES (
                gen_random_uuid(),
                target_room_id,
                target_user_id,
                rec.personal_no,
                CURRENT_TIMESTAMP,
                NULL,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            );
        EXCEPTION
            WHEN unique_violation THEN
                UPDATE room_assignment
                SET dorm_user_id = target_user_id,
                    assigned_at = CURRENT_TIMESTAMP,
                    released_at = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE room_id = target_room_id
                  AND personal_no = rec.personal_no
                  AND released_at IS NULL;
        END;
    END LOOP;
END $$;
