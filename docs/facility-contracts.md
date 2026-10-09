# 세 시설(세탁실·도서관·다목적실) DB·API·권한·중복 방지 계약서

*목적: Phase 2 확장 대상인 세탁실, 도서관, 다목적실/스터디룸의 데이터베이스 스키마(DDL), REST API 명세, 역할별 권한 및 누적 벌점 제재 규칙, 동시성/중복 방지 메커니즘을 명문화한 공식 계약 문서.*

---

## 1. 공통 시스템 제재 계약 (상·벌점 연동)

* **벌점 연동 규칙**:
  * 사용자의 누적 유효 벌점이 **10점 이상**일 경우, 시스템은 **세 시설(세탁실, 도서관, 다목적실)의 신규 이용 및 예약을 자동으로 전면 차단**한다.
  * **식생활 필수 시설인 냉장고는 기본 인권 보호를 위해 제재 대상에서 제외**한다.
* **차단 응답 표준**:
  * HTTP 상태 코드: `403 Forbidden`
  * 에러 코드: `FACILITY_ACCESS_SUSPENDED_BY_PENALTY`
  * 상세 메시지: `"누적 벌점이 10점 이상으로 시설 이용이 제한되었습니다. (현재 벌점: {points}점)"`

---

## 2. 🧺 세탁실 (Laundry) 계약

### 2.1 시설 기본 구성
* **남성 세탁실**: 세탁기 6대 (`WASHER_M01`~`M06`), 건조기 2대 (`DRYER_M01`~`M02`)
* **여성 세탁실**: 세탁기 7대 (`WASHER_F01`~`F07`), 건조기 6대 (`DRYER_F01`~`F06`)
* **남녀 공용**: 대형 이불 건조기 2대 (`DUVET_DRYER_01`~`02`, 남성 세탁실 구역 위치)
* **총 기기 수**: 23대

### 2.2 DB 스키마 계약 (DDL)
```sql
-- 기기 정보 테이블
CREATE TABLE laundry_device (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_code     VARCHAR(32) NOT NULL UNIQUE,       -- 예: WASHER_M01, DUVET_DRYER_01
    display_name    VARCHAR(64) NOT NULL,              -- 예: 남성 세탁기 1호, 공용 이불 건조기 1호
    facility_zone   VARCHAR(16) NOT NULL,              -- MALE, FEMALE, COMMON
    device_type     VARCHAR(16) NOT NULL,              -- WASHER, DRYER, DUVET_DRYER
    status          VARCHAR(16) NOT NULL DEFAULT 'AVAILABLE', -- AVAILABLE, IN_USE, COMPLETED, MAINTENANCE
    default_duration_minutes INT NOT NULL DEFAULT 38,  -- 세탁기 기본 38분, 건조기 기본 50분
    current_user_id UUID REFERENCES dorm_user(id),
    started_at      TIMESTAMPTZ,
    expected_end_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_laundry_device_status CHECK (status IN ('AVAILABLE', 'IN_USE', 'COMPLETED', 'MAINTENANCE')),
    CONSTRAINT ck_laundry_device_zone CHECK (facility_zone IN ('MALE', 'FEMALE', 'COMMON')),
    CONSTRAINT ck_laundry_device_type CHECK (device_type IN ('WASHER', 'DRYER', 'DUVET_DRYER'))
);

-- 이용 기록 및 감사 로그
CREATE TABLE laundry_usage_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id       UUID NOT NULL REFERENCES laundry_device(id),
    dorm_user_id    UUID NOT NULL REFERENCES dorm_user(id),
    duration_minutes INT NOT NULL,
    adjusted_minutes INT NOT NULL DEFAULT 0,          -- 오차 정정 누적 분 (±10분)
    status          VARCHAR(16) NOT NULL,              -- RUNNING, FINISHED, FORCE_COMPLETED, CANCELLED
    started_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 세탁실 메시지 (수거 요청, 빼놨어요 알림)
CREATE TABLE laundry_message (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id       UUID NOT NULL REFERENCES laundry_device(id),
    sender_id       UUID NOT NULL REFERENCES dorm_user(id),
    recipient_id    UUID NOT NULL REFERENCES dorm_user(id),
    message_type    VARCHAR(32) NOT NULL,              -- WAITING_PICKUP, REMOVED_LAUNDRY, CUSTOM
    content         VARCHAR(255) NOT NULL,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 고장 신고 내역
CREATE TABLE laundry_maintenance_report (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id       UUID NOT NULL REFERENCES laundry_device(id),
    reporter_id     UUID NOT NULL REFERENCES dorm_user(id),
    issue_description TEXT NOT NULL,
    resolved        BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_by     UUID REFERENCES dorm_user(id),
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 2.3 API 계약
| Method | Path | Request Body | Description | 에러 코드 |
|---|---|---|---|---|
| `GET` | `/laundry/devices` | Query: `zone`, `type` | 전체 세탁/건조 기기 목록 및 실시간 상태 조회 | - |
| `POST` | `/laundry/devices/{id}/start` | `{ "durationMinutes": 38 }` | 기기 사용 시작 (상태 `IN_USE` 전환) | `DEVICE_ALREADY_IN_USE` (409), `MAX_CONCURRENT_DEVICES_EXCEEDED` (422), `ZONE_ACCESS_FORBIDDEN` (403) |
| `PATCH` | `/laundry/devices/{id}/adjust-time` | `{ "deltaMinutes": 5, "reason": "거품 추가" }` | 남은 시간 정정 (±10분 범위, 타인일 경우 알림 전송) | `ADJUSTMENT_LIMIT_EXCEEDED` (422), `DEVICE_NOT_RUNNING` (409) |
| `POST` | `/laundry/devices/{id}/messages` | `{ "messageType": "WAITING_PICKUP" }` | 미수거자에게 수거 요청 알림 전송 (완료 후 5분 경과 시) | `COOLDOWN_ACTIVE` (429), `NOT_COMPLETED` (409) |
| `POST` | `/laundry/devices/{id}/force-release` | `{ "reason": "바구니 이동" }` | 세탁물 정리 후 기기 강제 사용 가능(`AVAILABLE`) 전환 | `DEVICE_NOT_COMPLETED` (409) |
| `POST` | `/laundry/devices/{id}/reports` | `{ "description": "탈수 소음 심함" }` | 고장 신고 접수 및 기기 임시 차단 | - |

### 2.4 권한 매트릭스 및 중복 방지 계약
* **접근 구역 권한 (Zone Access)**:
  * 남성 거주자: `MALE`, `COMMON` 접근 가능 / `FEMALE` 접근 시 `403 ZONE_ACCESS_FORBIDDEN`.
  * 여성 거주자: `FEMALE`, `COMMON` 접근 가능 / `MALE` 접근 시 `403 ZONE_ACCESS_FORBIDDEN`.
* **동시성 및 중복 방지 (Concurrency Contract)**:
  1. **단일 기기 동시 선점 방지**: 기기 상태를 `AVAILABLE`에서 `IN_USE`로 변경할 때 조건부 원자적 갱신(`UPDATE laundry_device SET status='IN_USE' WHERE id=? AND status='AVAILABLE'`)을 강제하여 충돌 시 `409 DEVICE_ALREADY_IN_USE` 반환.
  2. **1인 동시 보유 상한**: 1명의 사용자가 동시에 세탁기 1대 + 건조기 1대를 초과하여 선점할 수 없음 (동시 사용 중인 기기 수 2개 이상일 때 `422 MAX_CONCURRENT_DEVICES_EXCEEDED`).

---

## 3. 📚 도서관 (Library) 계약

### 3.1 시설 기본 구성
* 기숙사 보유 공용 도서 (IT, 소설, 교양 등).
* 1인 최대 대출 한도: 3권, 기본 대출 기간: 14일, 연장: 1회(+7일).
* **예약 대기열 규칙**: 도서 1권당 **최대 1명만 예약 가능** (대기열 비대화 방지).

### 3.2 DB 스키마 계약 (DDL)
```sql
-- 도서 정보 테이블
CREATE TABLE library_book (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_number     VARCHAR(32) NOT NULL UNIQUE,       -- 기숙사 도서 등록 번호 (예: BK-2026-001)
    title           VARCHAR(200) NOT NULL,
    author          VARCHAR(100) NOT NULL,
    isbn            VARCHAR(20),
    category        VARCHAR(32) NOT NULL,              -- IT, NOVEL, ESSAY, SCIENCE 등
    status          VARCHAR(16) NOT NULL DEFAULT 'AVAILABLE', -- AVAILABLE, BORROWED, RESERVED, LOST
    current_loan_id UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_library_book_status CHECK (status IN ('AVAILABLE', 'BORROWED', 'RESERVED', 'LOST'))
);

-- 대출 기록 테이블
CREATE TABLE library_loan (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id         UUID NOT NULL REFERENCES library_book(id),
    dorm_user_id    UUID NOT NULL REFERENCES dorm_user(id),
    borrowed_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    due_date        DATE NOT NULL,                     -- 기본 borrowed_at + 14일
    returned_at     TIMESTAMPTZ,
    extended_count  INT NOT NULL DEFAULT 0,            -- 최대 1회 허용
    status          VARCHAR(16) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, RETURNED, OVERDUE, LOST
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_library_loan_status CHECK (status IN ('ACTIVE', 'RETURNED', 'OVERDUE', 'LOST'))
);

-- 도서 예약 테이블 (대기열 최대 1명 제한)
CREATE TABLE library_reservation (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id         UUID NOT NULL REFERENCES library_book(id),
    dorm_user_id    UUID NOT NULL REFERENCES dorm_user(id),
    reserved_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    available_until TIMESTAMPTZ,                       -- 반납 후 대출 가능 유효 기간 (반납일 + 5일)
    status          VARCHAR(16) NOT NULL DEFAULT 'WAITING', -- WAITING, READY, COMPLETED, CANCELLED, EXPIRED
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_library_reservation_status CHECK (status IN ('WAITING', 'READY', 'COMPLETED', 'CANCELLED', 'EXPIRED'))
);

-- 💡 핵심 계약: 도서 1권당 활성 예약(WAITING, READY)은 오직 1건만 존재 가능
CREATE UNIQUE INDEX uq_library_active_reservation_per_book
ON library_reservation (book_id)
WHERE status IN ('WAITING', 'READY');

-- 💡 사용자 1명당 동일 도서 중복 예약 방지
CREATE UNIQUE INDEX uq_library_user_book_reservation
ON library_reservation (book_id, dorm_user_id)
WHERE status IN ('WAITING', 'READY');
```

### 3.3 API 계약
| Method | Path | Request Body | Description | 에러 코드 |
|---|---|---|---|---|
| `GET` | `/library/books` | Query: `search`, `category`, `status` | 도서 목록 검색 및 대출 가능 여부 조회 | - |
| `POST` | `/library/books/{id}/borrow` | - | 도서 대출 신청 (기본 14일) | `BOOK_NOT_AVAILABLE` (409), `MAX_LOAN_LIMIT_EXCEEDED` (422), `OVERDUE_RESTRICTION` (403), `RESERVED_FOR_ANOTHER` (403) |
| `POST` | `/library/books/{id}/return` | - | 도서 반납 처리 (예약자 있을 시 예약 상태 `READY` 전환 및 알림) | `NOT_BORROWED` (409) |
| `POST` | `/library/books/{id}/extend` | - | 반납 기한 연장 (1회 한정 +7일) | `EXTENSION_LIMIT_EXCEEDED` (422), `BOOK_RESERVED_BY_OTHER` (409), `LOAN_OVERDUE` (422) |
| `POST` | `/library/books/{id}/reserve` | - | 도서 예약 신청 (대기열 1명 한정) | `RESERVATION_QUEUE_FULL` (409), `ALREADY_BORROWED_BY_SELF` (422), `ALREADY_RESERVED_BY_SELF` (409) |
| `DELETE` | `/library/reservations/{id}` | - | 도서 예약 취소 | `RESERVATION_NOT_CANCELLABLE` (400) |

### 3.4 권한 매트릭스 및 중복 방지 계약
* **연체자 대출 차단**: 현재 반납 기일이 지난 연체 도서를 1권이라도 보유한 입주자는 모든 신규 대출 금지 (`403 OVERDUE_RESTRICTION`).
* **동시성 및 중복 방지 (Concurrency Contract)**:
  1. **동시 대출 방지**: 도서 대출 시 `status='AVAILABLE'` 확인 후 트랜잭션 내에서 `status='BORROWED'`로 원자적 전환 (경합 시 `409 BOOK_NOT_AVAILABLE`).
  2. **대기열 1인 엄격 제한**: `uq_library_active_reservation_per_book` 부분 유니크 인덱스로 DB 수준에서 도서당 2명 이상의 동시 예약 원천 차단 (`409 RESERVATION_QUEUE_FULL`).
  3. **예약자 우선권 보장**: 반납 시점에 예약자가 있는 도서는 `AVAILABLE`이 아닌 `RESERVED` 상태로 전환되며, 예약자 본인만 5일 이내 대출 가능 (타인 대출 시 `403 RESERVED_FOR_ANOTHER`).

---

## 4. 🏢 다목적실 / 스터디룸 (Study Room) 계약

### 4.1 시설 기본 구성
* 3개 스터디룸: `ROOM_A` (4인실), `ROOM_B` (6인실), `ROOM_C` (8인실).
* 예약 단위: 10분 단위, 최소 30분 ~ 최대 3시간.
* 주간 예약 범위: 오늘 기준 ~ 다음 주 일요일까지.
* 합석(Co-use) 옵션 지원: 비합석 시 단독 배타적 사용, 합석 허용 시 정원 내 다중 예약 허용.

### 4.2 DB 스키마 계약 (DDL)
```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 다목적실 룸 메타데이터
CREATE TABLE study_room (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_code       VARCHAR(16) NOT NULL UNIQUE,       -- ROOM_A, ROOM_B, ROOM_C
    display_name    VARCHAR(64) NOT NULL,              -- 스터디룸 A (소회의실), 스터디룸 B 등
    capacity        INT NOT NULL DEFAULT 4,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 예약 테이블
CREATE TABLE study_room_reservation (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id         UUID NOT NULL REFERENCES study_room(id),
    dorm_user_id    UUID NOT NULL REFERENCES dorm_user(id),
    start_time      TIMESTAMPTZ NOT NULL,
    end_time        TIMESTAMPTZ NOT NULL,
    duration_minutes INT NOT NULL,                     -- 30 ~ 180분
    allow_co_use    BOOLEAN NOT NULL DEFAULT FALSE,    -- 합석 허용 여부
    attendee_count  INT NOT NULL DEFAULT 1,
    status          VARCHAR(16) NOT NULL DEFAULT 'CONFIRMED', -- CONFIRMED, CANCELLED, NO_SHOW, COMPLETED
    cancellation_reason TEXT,
    cancelled_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_study_reservation_time CHECK (end_time > start_time),
    CONSTRAINT ck_study_reservation_duration CHECK (duration_minutes >= 30 AND duration_minutes <= 180),
    CONSTRAINT ck_study_reservation_status CHECK (status IN ('CONFIRMED', 'CANCELLED', 'NO_SHOW', 'COMPLETED'))
);

-- 💡 핵심 계약: 비합석 단독 예약 시 동일 룸 시간대 겹침(Overlap) 차단 Exclusion Constraint
ALTER TABLE study_room_reservation
ADD CONSTRAINT exclude_overlapping_exclusive_reservation
EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
)
WHERE (status = 'CONFIRMED' AND allow_co_use = FALSE);

-- 💡 1인 동시간대 다중 룸 중복 예약 차단
ALTER TABLE study_room_reservation
ADD CONSTRAINT exclude_user_concurrent_reservation
EXCLUDE USING gist (
    dorm_user_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
)
WHERE (status = 'CONFIRMED');

-- 노쇼 / 미등록 신고 테이블
CREATE TABLE study_room_report (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id  UUID NOT NULL REFERENCES study_room_reservation(id),
    reporter_id     UUID NOT NULL REFERENCES dorm_user(id),
    report_type     VARCHAR(16) NOT NULL,              -- NO_SHOW, UNREGISTERED_USE
    status          VARCHAR(16) NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
    penalty_issued  BOOLEAN NOT NULL DEFAULT FALSE,
    reviewed_by     UUID REFERENCES dorm_user(id),
    reviewed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 4.3 API 계약
| Method | Path | Request Body | Description | 에러 코드 |
|---|---|---|---|---|
| `GET` | `/study/rooms` | - | 전체 스터디룸 목록 및 기본 정원 조회 | - |
| `GET` | `/study/timeline` | Query: `date`, `roomId` | 특정 일자/룸의 10분 단위 타임라인 예약 현황 조회 | - |
| `POST` | `/study/reservations` | `{ "roomId": "...", "startTime": "...", "endTime": "...", "allowCoUse": false }` | 스터디룸 예약 생성 | `TIME_SLOT_OVERLAPPED` (409), `USER_ALREADY_RESERVED_TIME` (409), `INVALID_DURATION` (400), `ADVANCE_BOOKING_EXCEEDED` (422) |
| `DELETE` | `/study/reservations/{id}` | `{ "reason": "개인 사정" }` | 예약 취소 (시작 1시간 전 무료, 1시간 이내 급작스런 취소 시 벌점 1점 자동 부과) | `RESERVATION_ALREADY_STARTED` (400), `UNAUTHORIZED_USER` (403) |
| `POST` | `/study/reports` | `{ "reservationId": "...", "reportType": "NO_SHOW" }` | 노쇼 또는 미등록 이용 신고 접수 | `REPORT_COOLDOWN_ACTIVE` (429) |
| `POST` | `/admin/study/reservations/block` | `{ "roomId": "...", "startTime": "...", "endTime": "...", "reason": "유지보수" }` | 관리자 강제 점유 / 일반 예약 차단 | - |

### 4.4 권한 매트릭스 및 중복 방지 계약
* **급작스런 취소 벌점 연동**:
  * 예약 시작 시각 60분 이내 취소 시 `penalty_history`에 사유 `"다목적실 시작 1시간 이내 급작스러운 취소"`로 **벌점 1점 자동 부과**.
  * 노쇼 신고 승인 시 사유 `"다목적실 예약 노쇼"`로 **벌점 2점 수동 부과**.
* **동시성 및 중복 방지 (Concurrency Contract)**:
  1. **동일 룸 시간대 충돌 방지**: PostgreSQL의 `EXCLUDE USING gist` 제약 조건으로 비합석 예약(`allow_co_use = FALSE`) 간 시간 범위(`tstzrange`) 겹침을 DB 엔진 수준에서 100% 차단 (`409 TIME_SLOT_OVERLAPPED`).
  2. **1인 동시간 중복 예약 방지**: 동일 사용자가 동시간대에 서로 다른 룸 2개 이상을 예약하지 못하도록 `exclude_user_concurrent_reservation` 제약 조건으로 차단 (`409 USER_ALREADY_RESERVED_TIME`).
  3. **비관적 락(SELECT FOR UPDATE)**: 예약 트랜잭션 시작 시 해당 일자/룸의 메타데이터 행을 선점하여 동시 요청 간의 정밀한 정원 초과 검증 보장.

---

## 5. 종합 권한 매트릭스 (RBAC Matrix)

| 구분 | 일반 거주자 (`RESIDENT`) | 층별장 (`FLOOR_MANAGER`) | 관리자 (`ADMIN`) |
|:---|:---:|:---:|:---:|
| **세탁실 기기 사용 등록** | 본인 성별/공용 구역 허용 | 동일 | 전체 구역 강제 제어 |
| **세탁실 시간 정정** | 본인 기기 무제한, 타인 기기 ±10분 | 동일 | 무제한 정정 |
| **세탁실 고장 처리** | 신고만 가능 | 신고만 가능 | 기기 상태 수동 강제 전환 (`MAINTENANCE`) |
| **도서 검색 / 대출 / 연장** | 최대 3권, 14일, 1회 연장 | 동일 | 대출 현황 전체 관제 |
| **도서 등록 / 수정 / 폐기** | 불가 | 불가 | 전권 관리 가능 |
| **도서 강제 반납 / 분실 처리** | 불가 | 불가 | 가능 (분실자 벌점 부과) |
| **다목적실 타임라인 예약** | 주간 타임라인(30분~3시간) | 동일 | 기간 제한 없는 강제 예약/차단 |
| **다목적실 시작 1시간 전 취소** | 패널티 없음 | 동일 | 관리자 사유 입력 취소 |
| **다목적실 시작 1시간 내 취소** | **벌점 1점 자동 부과** | **벌점 1점 자동 부과** | 패널티 면제 |
| **노쇼 신고 승인 및 벌점 부과** | 불가 (신고 접수만) | 불가 (신고 접수만) | 승인 시 **벌점 2점 부과** |
| **벌점 10점 초과 시** | **세 시설 전체 이용 차단** | **세 시설 전체 이용 차단** | 면제 (시스템 관리자) |
