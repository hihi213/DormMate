-- =========================
-- seed.sql
-- 목적: 코드값과 예시 데이터를 최소 삽입한다.
-- 원칙: 실전 흐름을 보여주는 작은 샘플을 제공한다.
-- =========================

SET time_zone = '+00:00'; -- UTC 기준으로 기록한다.

-- =============
-- 섹션: 코드 테이블 시드
-- 설명: 상태·유형·알림 종류를 초기화한다.
-- =============

INSERT INTO BundleStatus(code,display_name,description,is_terminal,sort_order)
VALUES
('NORMAL','정상','사용 가능한 상태',FALSE,1),
('REMOVED','삭제됨','사용자 자진 삭제',TRUE,2),
('DISPOSED','폐기됨','검사로 폐기됨',TRUE,3);

INSERT INTO ItemState(code,next_states,is_terminal)
VALUES
('NORMAL', JSON_ARRAY('IMMINENT','DISPOSED'), FALSE),
('IMMINENT', JSON_ARRAY('EXPIRED','DISPOSED'), FALSE),
('EXPIRED', JSON_ARRAY('DISPOSED'), FALSE),
('DISPOSED', JSON_ARRAY(), TRUE);

INSERT INTO InspectionActionType(code,requires_reason)
VALUES
('PASS', FALSE),
('WARN', TRUE),
('DISPOSE', TRUE),
('UNREGISTERED_DISPOSE', TRUE);

INSERT INTO WarningReason(code,action_type_code)
VALUES
('INFO_MISMATCH','WARN'),
('STORAGE_ISSUE','WARN'),
('STICKER_MISSING','WARN');

INSERT INTO NotificationKind(code,module,severity,ttl_hours,template)
VALUES
('FRIDGE_EXPIRY','FRIDGE',3,24,'임박: {{bundle}} {{count}}건'),
('INSPECTION_RESULT','FRIDGE',4,72,'검사 결과 요약'),
('ROOM_START','ROOM',1,24,'입사 안내');

-- =============
-- 섹션: 기본 공간과 사용자
-- 설명: 2층에 방 201,202. 관리자, 거주자, 검사자를 만든다.
-- 예시: 201호 개인번호 1 사용자가 거주한다.
-- =============

INSERT INTO Rooms(floor,room_number,capacity,type)
VALUES
(2,'01',3,'TRIPLE'),
(2,'02',3,'TRIPLE');

INSERT INTO Users(email,password_hash,room_id,personal_no,role,is_active)
VALUES
('a@dm.test','$2y$hash.admin',NULL,NULL,'ADMIN',TRUE),
('201-1@test','$$hash2011',
 (SELECT id FROM Rooms WHERE floor=2 AND room_number='01'),1,'RESIDENT',TRUE),
('202-1@test','$$hash2021',
 (SELECT id FROM Rooms WHERE floor=2 AND room_number='02'),1,'RESIDENT',TRUE),
('inspector@test','$$hashinsp',NULL,NULL,'INSPECTOR',TRUE);

-- =============
-- 섹션: 자주 쓰는 변수 초기화
-- 설명: 반복 조회를 줄이기 위해 ID를 변수에 저장한다.
-- =============

SET @user_admin = (SELECT id FROM Users WHERE email='a@dm.test');
SET @user_201_1 = (SELECT id FROM Users WHERE email='201-1@test');
SET @user_202_1 = (SELECT id FROM Users WHERE email='202-1@test');
SET @user_inspector = (SELECT id FROM Users WHERE email='inspector@test');

-- =============
-- 섹션: 냉장고와 칸
-- 설명: 2층 1번 냉장고. 칸1=FRIDGE(1~50), 칸2=FREEZER(51~100)
-- =============

INSERT INTO FridgeUnits(floor,unit_no,building) VALUES (2,1,'A');

INSERT INTO Compartments(
  unit_id,slot_number,type,label_range_start,label_range_end
) VALUES
((SELECT id FROM FridgeUnits WHERE floor=2 AND unit_no=1),1,'FRIDGE',1,50),
((SELECT id FROM FridgeUnits WHERE floor=2 AND unit_no=1),2,'FREEZER',51,100);

SET @comp_1 = (SELECT c.id FROM Compartments c
               JOIN FridgeUnits u ON u.id=c.unit_id
               WHERE u.floor=2 AND u.unit_no=1 AND c.slot_number=1);
SET @comp_2 = (SELECT c.id FROM Compartments c
               JOIN FridgeUnits u ON u.id=c.unit_id
               WHERE u.floor=2 AND u.unit_no=1 AND c.slot_number=2);

-- 배분 규칙: 201호→칸1, 202호→칸2
INSERT INTO CompartmentRoomAccess(
  compartment_id,room_id,allocation_rule,active_from,active_to
) VALUES
(@comp_1, (SELECT id FROM Rooms WHERE floor=2 AND room_number='01'),
 'DIRECT','2025-10-01',NULL),
(@comp_2, (SELECT id FROM Rooms WHERE floor=2 AND room_number='02'),
 'DIRECT','2025-10-01',NULL);

-- =============
-- 섹션: 라벨 풀
-- 설명: 각 칸의 라벨 번호를 사전 생성한다. 샘플 10개씩 만든다.
-- =============

-- 칸1: 1~10
INSERT INTO LabelPool(compartment_id,label_number,status)
SELECT @comp_1, n, 0
FROM (
  SELECT 1 n UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
  UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL
  SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10
) nums;

-- 칸2: 51~60
INSERT INTO LabelPool(compartment_id,label_number,status)
SELECT @comp_2, n, 0
FROM (
  SELECT 51 n UNION ALL SELECT 52 UNION ALL SELECT 53 UNION ALL SELECT 54
  UNION ALL SELECT 55 UNION ALL SELECT 56 UNION ALL SELECT 57 UNION ALL
  SELECT 58 UNION ALL SELECT 59 UNION ALL SELECT 60
) nums;

-- =============
-- 섹션: 샘플 묶음과 아이템(실전 흐름)
-- 설명: SKIP LOCKED로 라벨을 발급하고 묶음을 만든다.
-- 주의: 트랜잭션으로 선정→사용을 원자화한다.
-- =============

START TRANSACTION;

SET @acq_comp = NULL, @acq_label = NULL;
SELECT compartment_id, label_number
INTO @acq_comp, @acq_label
FROM LabelPool
WHERE status = 0 AND compartment_id = @comp_1
ORDER BY label_number
LIMIT 1
FOR UPDATE SKIP LOCKED; -- 동시 발급 안전

UPDATE LabelPool
SET status = 1, last_used_at = CURRENT_TIMESTAMP
WHERE compartment_id = @acq_comp AND label_number = @acq_label;

SET @created_label_code = CONCAT('1-', LPAD(@acq_label, 3, '0'));

INSERT INTO FridgeBundles(
  owner_id,compartment_id,label_code,bundle_name,status_code
) VALUES
(@user_201_1, @acq_comp, @created_label_code, '아침 식재료', 'NORMAL');

COMMIT;

-- 아이템 2개 생성: 계란 3일 후, 우유 1일 후 만료
INSERT INTO FridgeItems(bundle_id,item_name,expiry_date,state_code,memo)
VALUES
((SELECT id FROM FridgeBundles WHERE label_code=@created_label_code),
 '계란', DATE_ADD(CURDATE(), INTERVAL 3 DAY),'IMMINENT',NULL),
((SELECT id FROM FridgeBundles WHERE label_code=@created_label_code),
 '우유', DATE_ADD(CURDATE(), INTERVAL 1 DAY),'IMMINENT',NULL);

-- =============
-- 섹션: 알림 예시(단일 테이블)
-- 설명: 목록은 preview_json, 상세는 detail_json에 저장한다.
-- 규칙: 같은 사용자·종류·날짜·묶음은 dedupe로 1회만 생성한다.
-- =============

INSERT INTO Notifications(
  user_id, kind_code, title, preview_json, detail_json, dedupe_key,
  ttl_at, related_bundle_id
) VALUES
(
  @user_201_1,
  'FRIDGE_EXPIRY',
  '유통기한 임박 알림',
  JSON_OBJECT(
    'summary','계란 외 1개 물품의 유통기한이 임박했습니다.',
    'item_names', JSON_ARRAY('계란','우유'),
    'counts', JSON_OBJECT('imminent',2,'expired',0),
    'icon','expiry_warning'
  ),
  JSON_OBJECT(
    'type','FRIDGE_EXPIRY',
    'bundle_id',(SELECT id FROM FridgeBundles
                 WHERE label_code=@created_label_code),
    'item_count',2,
    'warning_count',1,
    'dispose_count',0,
    'items', JSON_ARRAY(
      JSON_OBJECT('name','계란','expiry_date',
        DATE_FORMAT(DATE_ADD(CURDATE(),INTERVAL 3 DAY),'%Y-%m-%d'),
        'state','IMMINENT'),
      JSON_OBJECT('name','우유','expiry_date',
        DATE_FORMAT(DATE_ADD(CURDATE(),INTERVAL 1 DAY),'%Y-%m-%d'),
        'state','IMMINENT')
    )
  ),
  RPAD('demo_dedupe_key_201_2025_10_12_bundle_1',64,'x'),
  DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 24 HOUR),
  (SELECT id FROM FridgeBundles WHERE label_code=@created_label_code)
);

-- =============
-- 섹션: 검사 예시
-- 설명: 세션 생성 후 검사자 참여, 경고 조치 1건을 기록한다.
-- =============

INSERT INTO InspectionSessions(compartment_id,session_uuid,status)
VALUES
(@comp_1,'11111111-1111-1111-1111-111111111111','OPEN');

INSERT INTO InspectionInspectors(session_id,inspector_id)
VALUES
((SELECT id FROM InspectionSessions WHERE session_uuid=
  '11111111-1111-1111-1111-111111111111'),
 @user_inspector);

INSERT INTO InspectionActions(
  session_id,inspector_id,bundle_id,action_type_code,reason_code,memo
) VALUES
(
 (SELECT id FROM InspectionSessions WHERE session_uuid=
  '11111111-1111-1111-1111-111111111111'),
 @user_inspector,
 (SELECT id FROM FridgeBundles WHERE label_code=@created_label_code),
 'WARN','STICKER_MISSING','스티커 위치 식별 어려움'
);

-- =============
-- 섹션: 검사 결과 알림 예시
-- 설명: 세션 기반 알림. related_session_id로 빠르게 필터링한다.
-- =============

INSERT INTO Notifications(
  user_id, kind_code, title, preview_json, detail_json, dedupe_key,
  ttl_at, related_session_id
) VALUES
(
  @user_201_1,
  'INSPECTION_RESULT',
  '냉장고 검사 결과',
  JSON_OBJECT('summary','검사 결과: 경고 1건, 폐기 0건'),
  JSON_OBJECT(
    'type','INSPECTION_RESULT',
    'session_id',(SELECT id FROM InspectionSessions WHERE session_uuid=
      '11111111-1111-1111-1111-111111111111'),
    'affected_bundles',1,
    'actions', JSON_ARRAY(
      JSON_OBJECT(
        'bundle_id',(SELECT id FROM FridgeBundles
                     WHERE label_code=@created_label_code),
        'action','WARN','reason','STICKER_MISSING'
      )
    )
  ),
  RPAD('demo_dedupe_key_inspection_201',64,'y'),
  DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 72 HOUR),
  (SELECT id FROM InspectionSessions WHERE session_uuid=
   '11111111-1111-1111-1111-111111111111')
);

-- =============
-- 섹션: 라벨 반환 트리거 시연
-- 설명: 묶음을 REMOVED로 바꾸어 라벨 자동 반환을 시연한다.
-- =============

UPDATE FridgeBundles
SET status_code = 'REMOVED'
WHERE label_code = @created_label_code;

-- =============
-- 섹션: 일반 공지 알림 예시(ROOM_START)
-- 설명: 모듈 독립 알림. 관련 FK 없이 detail_json만 사용한다.
-- =============

INSERT INTO Notifications(
  user_id, kind_code, title, preview_json, detail_json, dedupe_key,
  ttl_at
) VALUES
(
  @user_201_1,
  'ROOM_START',
  '입사 안내',
  JSON_OBJECT(
    'summary','환영합니다. 생활 안내를 확인하세요.',
    'icon','info'
  ),
  JSON_OBJECT(
    'type','ROOM_START',
    'links', JSON_ARRAY(
      JSON_OBJECT('title','생활 수칙','url','/guide/rules'),
      JSON_OBJECT('title','층별 담당','url','/guide/staff')
    )
  ),
  RPAD('demo_dedupe_key_room_start_201',64,'z'),
  DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 24 HOUR)
);

-- =============
-- 섹션: 관리자 작업 로그 예시
-- 설명: 권한 변경 같은 운영 이벤트를 기록한다.
-- 주의: actor_role_at_action은 당시 역할을 저장한다.
-- =============

INSERT INTO AuditLogs(
  actor_id, actor_role_at_action, scope, ref_type, ref_id, action, after_json
) VALUES
(
  @user_admin,
  'ADMIN',
  'USER',
  'User',
  @user_inspector,
  'GRANT_INSPECTOR_ROLE',
  JSON_OBJECT('previous_role','RESIDENT','new_role','INSPECTOR')
);

