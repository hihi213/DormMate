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
            ROW_NUMBER() OVER (
                ORDER BY r.floor,
                         r.room_number::INTEGER,
                         ra.personal_no,
                         du.login_id
            ) AS global_seq
        FROM room_assignment ra
        JOIN room r ON r.id = ra.room_id
        JOIN dorm_user du ON du.id = ra.dorm_user_id
        WHERE ra.released_at IS NULL
          AND du.login_id NOT IN ('alice','bob','carol','dylan','diana','eric','fiona')
    ),
    max_seq AS (
        SELECT COALESCE(MAX(global_seq), 0) AS total_slots
        FROM active_assignments
    ),
    name_pool AS (
        SELECT seq, full_name
        FROM (
            SELECT
                ROW_NUMBER() OVER (
                    ORDER BY (given_ord * 53 + family_ord * 17),
                             family_ord,
                             given_ord
                ) AS seq,
                fam || given AS full_name
            FROM unnest(ARRAY[
                '강','고','곽','구','권','김','노','류','문','박','배','서','손','송','신',
                '안','양','오','유','윤','이','임','장','전','정','조','차','최','한','허','홍'
            ]::text[]) WITH ORDINALITY AS f(fam, family_ord)
            CROSS JOIN unnest(ARRAY[
                '다연','지현','민재','가람','서율','다온','태린','시온','라희','하은',
                '준호','채윤','도원','세린','나율','예진','가율','도현','민서','다해',
                '서이','세아','윤후','재민','수현','태윤','라온','시우','다윤','서담',
                '지온','나리','하린','태이','주하','예린','시현','민호','서강','라온비',
                '하예린','서도윤','민서율','채아린','지호윤','다온슬','서리아','윤솔아','하로윤','민아설'
            ]::text[]) WITH ORDINALITY AS g(given, given_ord)
        ) np
        WHERE seq <= (SELECT total_slots FROM max_seq)
    )
    UPDATE dorm_user du
    SET full_name = np.full_name,
        updated_at = CURRENT_TIMESTAMP
    FROM active_assignments aa
    JOIN name_pool np
      ON np.seq = aa.global_seq
    WHERE du.id = aa.dorm_user_id;
END;
$$;

-- Demo/테스트 환경에서는 필요 시 수동 실행합니다.
--   SELECT public.fn_refresh_names_and_labels();
