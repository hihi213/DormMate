-- 모든 호실 슬롯에 최신 규칙(로그인 ID=층호실-개인번호, 비밀번호=user2025!)으로
-- 거주자 계정/배정이 채워지도록 보정한다. 이미 배정된 슬롯은 유지한다.

SET TIME ZONE 'UTC';

WITH room_slots AS (
    SELECT
        r.id AS room_id,
        r.floor AS floor_no,
        r.room_number AS room_number,
        slot.personal_no AS personal_no,
        concat(r.floor::text, r.room_number, '-', slot.personal_no::text) AS login_id,
        format('resident%s%s-%s@dormmate.dev', r.floor, r.room_number, slot.personal_no) AS email,
        ROW_NUMBER() OVER (
            PARTITION BY r.floor
            ORDER BY md5(concat(r.floor::text, '-', r.room_number, '-', slot.personal_no, '-seed'))
        ) AS floor_sequence
    FROM room r
    CROSS JOIN LATERAL generate_series(1, r.capacity) AS slot(personal_no)
    WHERE r.floor BETWEEN 2 AND 5
),
name_candidates AS (
    SELECT
        floor_val AS floor,
        ROW_NUMBER() OVER (
            PARTITION BY floor_val
            ORDER BY (given_ord * 53 + family_ord * 17), family_ord, given_ord
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
    CROSS JOIN LATERAL generate_series(2, 5) AS floor_val
),
named_slots AS (
    SELECT
        rs.room_id,
        rs.floor_no,
        rs.room_number,
        rs.personal_no,
        rs.login_id,
        rs.email,
        nc.full_name
    FROM room_slots rs
    JOIN name_candidates nc
      ON nc.floor = rs.floor_no
     AND nc.seq = rs.floor_sequence
),
user_upsert AS (
    INSERT INTO dorm_user (
        id,
        login_id,
        password_hash,
        full_name,
        email,
        status,
        created_at,
        updated_at
    )
    SELECT
        COALESCE(
            (SELECT id FROM dorm_user WHERE login_id = ns.login_id),
            gen_random_uuid()
        ),
        ns.login_id,
        crypt('user2025!', gen_salt('bf', 10)),
        ns.full_name,
        ns.email,
        'ACTIVE',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM named_slots ns
    ON CONFLICT (login_id) DO UPDATE
    SET full_name      = EXCLUDED.full_name,
        email          = EXCLUDED.email,
        status         = EXCLUDED.status,
        password_hash  = EXCLUDED.password_hash,
        updated_at     = CURRENT_TIMESTAMP
    RETURNING id, login_id
),
resident_role AS (
    INSERT INTO user_role (id, dorm_user_id, role_code, granted_at, created_at, updated_at)
    SELECT
        gen_random_uuid(),
        uu.id,
        'RESIDENT',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM user_upsert uu
    ON CONFLICT (dorm_user_id, role_code) WHERE revoked_at IS NULL DO NOTHING
)
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
SELECT
    gen_random_uuid(),
    ns.room_id,
    du.id,
    ns.personal_no,
    CURRENT_TIMESTAMP,
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM named_slots ns
JOIN dorm_user du ON du.login_id = ns.login_id
LEFT JOIN room_assignment ra
       ON ra.room_id = ns.room_id
      AND ra.personal_no = ns.personal_no
      AND ra.released_at IS NULL
WHERE ra.id IS NULL
ON CONFLICT (room_id, personal_no) WHERE released_at IS NULL DO NOTHING;

-- 기본 층별장 자리를 보장한다.
INSERT INTO user_role (id, dorm_user_id, role_code, granted_at, created_at, updated_at)
SELECT
    gen_random_uuid(),
    du.id,
    'FLOOR_MANAGER',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM dorm_user du
WHERE du.login_id = '205-3'
ON CONFLICT (dorm_user_id, role_code) WHERE revoked_at IS NULL DO NOTHING;
