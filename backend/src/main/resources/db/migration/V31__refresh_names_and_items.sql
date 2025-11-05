-- 현실감 있는 기숙사생 이름 갱신
-- 각 층별로 3~4글자의 고유 한글 이름을 적용한다.

SET TIME ZONE 'UTC';

CREATE OR REPLACE FUNCTION public.fn_refresh_names_and_labels()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM set_config('TimeZone', 'UTC', true);

    WITH active_assignments AS (
        SELECT
            ra.dorm_user_id,
            r.floor AS floor_no,
            ROW_NUMBER() OVER (
                PARTITION BY r.floor
                ORDER BY r.room_number::INTEGER, ra.personal_no, du.login_id
            ) AS rn
        FROM room_assignment ra
        JOIN room r ON r.id = ra.room_id
        JOIN dorm_user du ON du.id = ra.dorm_user_id
        WHERE ra.released_at IS NULL
          AND du.login_id NOT IN ('alice','bob','carol','dylan','diana','eric','fiona')
    ),
    name_pool AS (
        SELECT
            2 AS floor_no,
            CONCAT(s.val, m.val, e.val) AS name,
            ROW_NUMBER() OVER (ORDER BY s.val, m.val, e.val) AS rn
        FROM (VALUES ('강'),('곽'),('구'),('남'),('도')) AS s(val)
        CROSS JOIN (VALUES ('아'),('다'),('라'),('서')) AS m(val)
        CROSS JOIN (VALUES ('린'),('율'),('담'),('온')) AS e(val)

        UNION ALL

        SELECT
            3 AS floor_no,
            CONCAT(s.val, m.val, e.val) AS name,
            ROW_NUMBER() OVER (ORDER BY s.val, m.val, e.val) AS rn
        FROM (VALUES ('박'),('백'),('서'),('안'),('윤')) AS s(val)
        CROSS JOIN (VALUES ('해'),('민'),('시'),('채')) AS m(val)
        CROSS JOIN (VALUES ('솔'),('윤'),('람'),('온')) AS e(val)

        UNION ALL

        SELECT
            4 AS floor_no,
            CONCAT(s.val, m.val, e.val) AS name,
            ROW_NUMBER() OVER (ORDER BY s.val, m.val, e.val) AS rn
        FROM (VALUES ('임'),('장'),('전'),('최'),('허')) AS s(val)
        CROSS JOIN (VALUES ('도'),('라'),('서'),('하')) AS m(val)
        CROSS JOIN (VALUES ('윤'),('빈'),('아'),('율')) AS e(val)

        UNION ALL

        SELECT
            5 AS floor_no,
            CONCAT(s.val, m.val, e.val) AS name,
            ROW_NUMBER() OVER (ORDER BY s.val, m.val, e.val) AS rn
        FROM (VALUES ('문'),('배'),('신'),('오'),('표')) AS s(val)
        CROSS JOIN (VALUES ('가'),('나'),('다'),('라')) AS m(val)
        CROSS JOIN (VALUES ('온'),('윤'),('솔'),('율')) AS e(val)
    )
    UPDATE dorm_user du
    SET full_name = np.name,
        updated_at = CURRENT_TIMESTAMP
    FROM active_assignments aa
    JOIN name_pool np
      ON np.floor_no = aa.floor_no
     AND np.rn = aa.rn
    WHERE du.id = aa.dorm_user_id;
END;
$$;

SELECT public.fn_refresh_names_and_labels();
