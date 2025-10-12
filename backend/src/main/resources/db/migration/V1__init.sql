-- =========================
-- init.sql
-- 목적: DormMate 6주 MVP DB 스키마 최초 생성
-- 원칙: 단일 알림 테이블, UTC, ENUM 최소, 코드 테이블로 상수화
-- 주의: MySQL 8.0 기준. 타임존은 DB 세션에서 UTC로 고정한다.
-- =========================

SET time_zone = '+00:00'; -- 서버와 무관하게 UTC 기준 시간을 쓴다.

-- =============
-- 섹션: 코드 테이블
-- 설명: 비즈니스 상수를 테이블로 관리한다. 배포 없이 확장 가능.
-- 용어: code는 사람이 읽는 상수 키다. 예: 'NORMAL'
-- =============

CREATE TABLE BundleStatus (
  code              VARCHAR(20) PRIMARY KEY, -- 묶음 상태 코드
  display_name      VARCHAR(50) NOT NULL, -- UI용 이름
  description       TEXT NULL, -- 설명
  is_terminal       BOOLEAN NOT NULL DEFAULT FALSE, -- 종료 여부
  sort_order        INT NOT NULL DEFAULT 0, -- 정렬 우선순위
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ItemState (
  code              VARCHAR(20) PRIMARY KEY, -- 아이템 상태 코드
  next_states       JSON NOT NULL, -- 허용 전이 집합. 예: ["EXPIRED"]
  is_terminal       BOOLEAN NOT NULL DEFAULT FALSE, -- 종료 여부
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE NotificationKind (
  code              VARCHAR(30) PRIMARY KEY, -- 알림 종류
  module            VARCHAR(20) NOT NULL, -- 소속 모듈. 예: FRIDGE
  severity          TINYINT NOT NULL, -- 중요도 1~5
  ttl_hours         INT NOT NULL, -- 자동 만료 시간(시간)
  template          TEXT NULL, -- 렌더링 도움말
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE InspectionActionType (
  code              VARCHAR(30) PRIMARY KEY, -- 조치 코드
  requires_reason   BOOLEAN NOT NULL DEFAULT FALSE, -- 사유 필요
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE WarningReason (
  code              VARCHAR(40) PRIMARY KEY, -- 경고 사유
  action_type_code  VARCHAR(30) NOT NULL, -- 연관 조치
  CONSTRAINT fk_wr_act FOREIGN KEY (action_type_code)
    REFERENCES InspectionActionType(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============
-- 섹션: 공통 도메인
-- 설명: 호실, 사용자, 감사 로그를 정의한다.
-- 예시: 201호는 floor=2, room_number='01'로 기록한다.
-- =============

CREATE TABLE Rooms (
  id                BIGINT PRIMARY KEY AUTO_INCREMENT, -- PK
  floor             TINYINT NOT NULL, -- 층 번호
  room_number       VARCHAR(10) NOT NULL, -- 호실 코드
  capacity          TINYINT NOT NULL, -- 정원
  type              ENUM('SINGLE','TRIPLE') NOT NULL, -- 유형
  UNIQUE KEY uq_room (floor, room_number), -- 층+호실 유니크
  INDEX ix_floor (floor) -- 층별 조회
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE Users (
  id                BIGINT PRIMARY KEY AUTO_INCREMENT, -- PK
  email             VARCHAR(120) NOT NULL, -- 로그인 ID
  password_hash     VARCHAR(255) NOT NULL, -- 해시
  room_id           BIGINT NULL, -- 거주 호실
  personal_no       TINYINT NULL, -- 같은 방 내 개인 번호
  role              ENUM('RESIDENT','INSPECTOR','ADMIN') NOT NULL, -- 역할
  is_active         BOOLEAN NOT NULL DEFAULT TRUE, -- 사용 상태
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  deleted_at        TIMESTAMP NULL,
  UNIQUE KEY uq_email (email), -- 이메일 유니크
  UNIQUE KEY uq_room_person (room_id, personal_no), -- 방내 유니크
  INDEX ix_role_active (role, is_active), -- 역할별 조회
  CONSTRAINT fk_user_room FOREIGN KEY (room_id) REFERENCES Rooms(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE AuditLogs (
  id                BIGINT PRIMARY KEY AUTO_INCREMENT, -- PK
  actor_id          BIGINT NULL, -- 실행자
  actor_role_at_action VARCHAR(20) NULL, -- 당시 역할
  request_id        CHAR(36) NULL, -- 요청 상관관계 ID
  scope             VARCHAR(50) NOT NULL, -- 영역. 예: NOTIFICATION
  ref_type          VARCHAR(50) NULL, -- 참조 유형
  ref_id            BIGINT NULL, -- 참조 PK
  action            VARCHAR(100) NOT NULL, -- 수행 동작
  before_json       JSON NULL, -- 이전 상태
  after_json        JSON NULL, -- 이후 상태
  ip_address        VARCHAR(45) NULL, -- IPv4/6
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX ix_actor_time (actor_id, created_at DESC), -- 배우+시간
  INDEX ix_scope_ref (scope, ref_id, created_at DESC) -- 범위 조회
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============
-- 섹션: 냉장고 자원
-- 설명: 냉장고 본체와 칸, 라벨 풀, 배분 규칙을 정의한다.
-- 용어: compartment는 물리적 칸을 의미한다.
-- =============

CREATE TABLE FridgeUnits (
  id                BIGINT PRIMARY KEY AUTO_INCREMENT, -- PK
  building          VARCHAR(20) NULL, -- 동 구분
  floor             TINYINT NOT NULL, -- 설치 층
  unit_no           TINYINT NOT NULL, -- 같은 층 내 번호
  UNIQUE KEY uq_unit (floor, unit_no), -- 층+번호 유니크
  INDEX ix_unit_floor (floor) -- 층별 조회
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE Compartments (
  id                BIGINT PRIMARY KEY AUTO_INCREMENT, -- PK
  unit_id           BIGINT NOT NULL, -- 소속 냉장고
  slot_number       TINYINT NOT NULL, -- 칸 번호
  type              ENUM('FRIDGE','FREEZER') NOT NULL, -- 구역
  label_range_start INT NOT NULL, -- 라벨 시작
  label_range_end   INT NOT NULL, -- 라벨 끝
  lock_owner_session_id VARCHAR(36) NULL, -- 검사 세션
  lock_acquired_at  TIMESTAMP NULL, -- 잠금 시작
  lock_expires_at   TIMESTAMP NULL, -- 잠금 만료
  UNIQUE KEY uq_comp (unit_id, slot_number), -- 칸 유니크
  INDEX ix_lock_owner (lock_owner_session_id), -- 락 조회
  INDEX ix_lock_exp (lock_expires_at), -- 만료 스위퍼용
  CONSTRAINT fk_comp_unit FOREIGN KEY (unit_id) REFERENCES FridgeUnits(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 트리거: 잠금 시각의 논리 무결성을 검증한다.
DELIMITER $$
CREATE TRIGGER trg_comp_lock_validate
BEFORE INSERT ON Compartments
FOR EACH ROW
BEGIN
  IF NEW.lock_expires_at IS NOT NULL AND NEW.lock_acquired_at IS NOT NULL
     AND NEW.lock_expires_at <= NEW.lock_acquired_at THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT='lock_expires_at must be greater than acquired_at';
  END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE TRIGGER trg_comp_lock_validate_upd
BEFORE UPDATE ON Compartments
FOR EACH ROW
BEGIN
  IF NEW.lock_expires_at IS NOT NULL AND NEW.lock_acquired_at IS NOT NULL
     AND NEW.lock_expires_at <= NEW.lock_acquired_at THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT='lock_expires_at must be greater than acquired_at';
  END IF;
END$$
DELIMITER ;

CREATE TABLE CompartmentRoomAccess (
  id                BIGINT PRIMARY KEY AUTO_INCREMENT, -- PK
  compartment_id    BIGINT NOT NULL, -- 대상 칸
  room_id           BIGINT NOT NULL, -- 대상 호실
  allocation_rule   VARCHAR(50) NULL, -- 규칙명. 예: DIRECT
  active_from       DATE NOT NULL, -- 시작일
  active_to         DATE NULL, -- 종료일(NULL=유효)
  INDEX ix_comp_active (compartment_id, active_to), -- 칸별 규칙
  INDEX ix_room_active (room_id, active_to), -- 호실별 규칙
  CONSTRAINT fk_cra_comp FOREIGN KEY (compartment_id) REFERENCES Compartments(id),
  CONSTRAINT fk_cra_room FOREIGN KEY (room_id) REFERENCES Rooms(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 트리거: 규칙 기간 중첩을 금지한다. 폐구간 교차로 판정한다.
DELIMITER $$
CREATE TRIGGER trg_cra_no_overlap
BEFORE INSERT ON CompartmentRoomAccess
FOR EACH ROW
BEGIN
  DECLARE cnt INT DEFAULT 0;
  SELECT COUNT(*) INTO cnt
  FROM CompartmentRoomAccess
  WHERE compartment_id = NEW.compartment_id
    AND room_id = NEW.room_id
    AND COALESCE(NEW.active_to,'9999-12-31') >= active_from
    AND COALESCE(active_to,'9999-12-31') >= NEW.active_from;
  IF cnt > 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT='overlapping access period for room and compartment';
  END IF;
END$$
DELIMITER ;

-- 트리거: 갱신 시에도 중첩을 금지한다. 자기 행은 제외한다.
DELIMITER $$
CREATE TRIGGER trg_cra_no_overlap_upd
BEFORE UPDATE ON CompartmentRoomAccess
FOR EACH ROW
BEGIN
  DECLARE cnt INT DEFAULT 0;
  SELECT COUNT(*) INTO cnt
  FROM CompartmentRoomAccess
  WHERE compartment_id = NEW.compartment_id
    AND room_id = NEW.room_id
    AND id <> NEW.id
    AND COALESCE(NEW.active_to,'9999-12-31') >= active_from
    AND COALESCE(active_to,'9999-12-31') >= NEW.active_from;
  IF cnt > 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT='overlapping access period update';
  END IF;
END$$
DELIMITER ;

-- 라벨 풀: 동시 발급을 위해 SKIP LOCKED를 전제로 설계한다.
CREATE TABLE LabelPool (
  compartment_id    BIGINT NOT NULL, -- 칸 ID
  label_number      INT NOT NULL, -- 라벨 번호
  status            TINYINT NOT NULL DEFAULT 0, -- 0=가용 1=사용중
  last_used_bundle_id BIGINT NULL, -- 최근 사용 묶음
  last_used_at      TIMESTAMP NULL, -- 최근 사용 시각
  PRIMARY KEY (compartment_id, label_number), -- 복합 PK
  INDEX ix_label_status (compartment_id, status), -- 발급용
  CONSTRAINT fk_lp_comp FOREIGN KEY (compartment_id) REFERENCES Compartments(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============
-- 섹션: 냉장고 데이터
-- 설명: 묶음(라벨 단위)과 아이템을 기록한다.
-- 주의: 라벨 번호는 칸의 라벨 범위 안에 있어야 한다.
-- =============

CREATE TABLE FridgeBundles (
  id                BIGINT PRIMARY KEY AUTO_INCREMENT, -- PK
  owner_id          BIGINT NOT NULL, -- 사용자
  compartment_id    BIGINT NOT NULL, -- 칸
  label_code        VARCHAR(12) NOT NULL, -- 예: '1-005'
  bundle_name       VARCHAR(100) NULL, -- 표시명
  status_code       VARCHAR(20) NOT NULL, -- BundleStatus.code
  registered_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 등록
  last_modified_at  TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_label (label_code), -- 라벨 유니크
  INDEX ix_owner_status_reg (owner_id, status_code, registered_at DESC),
  INDEX ix_comp_status (compartment_id, status_code),
  INDEX ix_comp_modified (compartment_id, last_modified_at DESC),
  CONSTRAINT fk_fb_owner FOREIGN KEY (owner_id) REFERENCES Users(id),
  CONSTRAINT fk_fb_comp FOREIGN KEY (compartment_id) REFERENCES Compartments(id),
  CONSTRAINT fk_fb_status FOREIGN KEY (status_code) REFERENCES BundleStatus(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 트리거: 라벨 범위 검증. +1ms/INSERT. 무결성 우선.
DELIMITER $$
CREATE TRIGGER trg_fb_label_in_range
BEFORE INSERT ON FridgeBundles
FOR EACH ROW
BEGIN
  DECLARE lb INT; DECLARE ub INT;
  SELECT label_range_start, label_range_end INTO lb, ub
  FROM Compartments WHERE id = NEW.compartment_id;
  IF CAST(SUBSTRING_INDEX(NEW.label_code,'-',-1) AS UNSIGNED) NOT BETWEEN lb AND ub
  THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='label out of range';
  END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE TRIGGER trg_fb_label_in_range_upd
BEFORE UPDATE ON FridgeBundles
FOR EACH ROW
BEGIN
  DECLARE lb INT; DECLARE ub INT;
  SELECT label_range_start, label_range_end INTO lb, ub
  FROM Compartments WHERE id = NEW.compartment_id;
  IF CAST(SUBSTRING_INDEX(NEW.label_code,'-',-1) AS UNSIGNED) NOT BETWEEN lb AND ub
  THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='label out of range';
  END IF;
END$$
DELIMITER ;

-- 트리거: 묶음을 REMOVED로 바꾸면 라벨을 자동 반환한다.
DELIMITER $$
CREATE TRIGGER trg_bundle_removed_release_label
AFTER UPDATE ON FridgeBundles
FOR EACH ROW
BEGIN
  IF OLD.status_code <> 'REMOVED' AND NEW.status_code = 'REMOVED' THEN
    UPDATE LabelPool
       SET status = 0,
           last_used_bundle_id = NEW.id,
           last_used_at = CURRENT_TIMESTAMP
     WHERE compartment_id = NEW.compartment_id
       AND label_number = CAST(SUBSTRING_INDEX(NEW.label_code,'-',-1) AS UNSIGNED)
       AND (status = 1 OR last_used_bundle_id IS NULL
            OR last_used_bundle_id = NEW.id);
  END IF;
END$$
DELIMITER ;

CREATE TABLE FridgeItems (
  id                BIGINT PRIMARY KEY AUTO_INCREMENT, -- PK
  bundle_id         BIGINT NOT NULL, -- 소속 묶음
  item_name         VARCHAR(100) NOT NULL, -- 품목명
  expiry_date       DATE NULL, -- 유통기한
  state_code        VARCHAR(20) NOT NULL, -- ItemState.code
  memo              TEXT NULL, -- 메모
  INDEX ix_bundle (bundle_id), -- 묶음별 조회
  INDEX ix_state_exp (state_code, expiry_date), -- 임박 배치
  CONSTRAINT fk_fi_bundle FOREIGN KEY (bundle_id) REFERENCES FridgeBundles(id),
  CONSTRAINT fk_fi_state FOREIGN KEY (state_code) REFERENCES ItemState(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============
-- 섹션: 검사 시스템
-- 설명: 검사 세션과 참여자, 조치 이력을 기록한다.
-- 예시: OPEN 상태 세션은 동시 검사 관리에 사용한다.
-- =============

CREATE TABLE InspectionSessions (
  id                BIGINT PRIMARY KEY AUTO_INCREMENT, -- PK
  compartment_id    BIGINT NOT NULL, -- 대상 칸
  session_uuid      VARCHAR(36) NOT NULL, -- 세션 식별자
  status            ENUM('OPEN','SUBMITTED','CANCELLED') NOT NULL, -- 상태
  started_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 시작
  ended_at          TIMESTAMP NULL, -- 종료
  UNIQUE KEY uq_sess_uuid (session_uuid), -- UUID 유니크
  INDEX ix_comp_status (compartment_id, status), -- 칸+상태
  INDEX ix_status_started (status, started_at DESC), -- 진행중 조회
  CONSTRAINT fk_is_comp FOREIGN KEY (compartment_id) REFERENCES Compartments(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE InspectionInspectors (
  id                BIGINT PRIMARY KEY AUTO_INCREMENT, -- PK
  session_id        BIGINT NOT NULL, -- 세션
  inspector_id      BIGINT NOT NULL, -- 검사자
  joined_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 참여시각
  UNIQUE KEY uq_sess_user (session_id, inspector_id), -- 중복 방지
  INDEX ix_inspector (inspector_id), -- 검사자별 조회
  CONSTRAINT fk_ii_sess FOREIGN KEY (session_id) REFERENCES InspectionSessions(id),
  CONSTRAINT fk_ii_user FOREIGN KEY (inspector_id) REFERENCES Users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE InspectionActions (
  id                BIGINT PRIMARY KEY AUTO_INCREMENT, -- PK
  session_id        BIGINT NOT NULL, -- 세션
  inspector_id      BIGINT NOT NULL, -- 검사자
  bundle_id         BIGINT NULL, -- 미등록 물품이면 NULL
  action_type_code  VARCHAR(30) NOT NULL, -- 조치 코드
  reason_code       VARCHAR(40) NULL, -- 사유 코드
  memo              TEXT NULL, -- 비고
  unregistered_item_name VARCHAR(100) NULL, -- 미등록명
  action_time       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 시각
  INDEX ix_sess (session_id), -- 세션별 조회
  INDEX ix_bundle (bundle_id), -- 묶음별 조회
  INDEX ix_type_time (action_type_code, action_time), -- 분석용
  CONSTRAINT fk_ia_sess FOREIGN KEY (session_id) REFERENCES InspectionSessions(id),
  CONSTRAINT fk_ia_user FOREIGN KEY (inspector_id) REFERENCES Users(id),
  CONSTRAINT fk_ia_bundle FOREIGN KEY (bundle_id) REFERENCES FridgeBundles(id),
  CONSTRAINT fk_ia_type FOREIGN KEY (action_type_code)
    REFERENCES InspectionActionType(code),
  CONSTRAINT fk_ia_reason FOREIGN KEY (reason_code)
    REFERENCES WarningReason(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============
-- 섹션: 알림(단일 테이블)
-- 설명: 목록은 프리렌더, 상세는 JSON으로 저장한다.
-- 기능: 역정규화 FK로 빠른 필터링을 지원한다.
-- =============

CREATE TABLE Notifications (
  id                BIGINT PRIMARY KEY AUTO_INCREMENT, -- PK
  user_id           BIGINT NOT NULL, -- 대상 사용자
  kind_code         VARCHAR(30) NOT NULL, -- 알림 종류
  title             VARCHAR(100) NOT NULL, -- 제목
  preview_json      JSON NULL, -- 목록용 프리렌더
  preview_summary   VARCHAR(120)
    GENERATED ALWAYS AS
    (JSON_UNQUOTE(JSON_EXTRACT(preview_json,'$.summary'))) STORED,
  detail_json       JSON NULL, -- 상세 데이터(JSON)
  related_bundle_id BIGINT NULL, -- 냉장고 알림용 FK
  related_session_id BIGINT NULL, -- 검사 알림용 FK
  dedupe_key        CHAR(64) NOT NULL, -- 중복 방지 키
  is_read           BOOLEAN NOT NULL DEFAULT FALSE, -- 읽음 여부
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 생성
  ttl_at            TIMESTAMP NULL, -- 만료 시각
  UNIQUE KEY uq_dedupe (dedupe_key), -- 중복 차단
  INDEX ix_notif_list (user_id, is_read, created_at DESC, id, kind_code),
  INDEX ix_notif_ttl (ttl_at), -- 만료 배치
  INDEX ix_bundle (related_bundle_id), -- 묶음별 조회
  INDEX ix_session (related_session_id), -- 세션별 조회
  CONSTRAINT fk_n_user FOREIGN KEY (user_id) REFERENCES Users(id),
  CONSTRAINT fk_n_kind FOREIGN KEY (kind_code) REFERENCES NotificationKind(code),
  CONSTRAINT fk_n_bundle FOREIGN KEY (related_bundle_id)
    REFERENCES FridgeBundles(id) ON DELETE SET NULL,
  CONSTRAINT fk_n_session FOREIGN KEY (related_session_id)
    REFERENCES InspectionSessions(id) ON DELETE SET NULL,
  CONSTRAINT chk_related_entity CHECK (
    (kind_code IN ('FRIDGE_EXPIRY','FRIDGE_OTHER')
     AND related_bundle_id IS NOT NULL) OR
    (kind_code IN ('INSPECTION_RESULT','INSPECTION_OTHER')
     AND related_session_id IS NOT NULL) OR
    (kind_code NOT IN ('FRIDGE_EXPIRY','FRIDGE_OTHER',
                       'INSPECTION_RESULT','INSPECTION_OTHER'))
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;