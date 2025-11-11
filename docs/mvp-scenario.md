# DormMate 냉장고 MVP 시연 시나리오
*이번 배포/데모에서 반드시 보여 줄 사용자 흐름과 정책을 정리한 기준 문서입니다. 모든 설명은 현재 구현(2025-11)과 동기화되어 있습니다.*

## 1. 데모 목표
- 라벨 자동 발급, 검사·벌점·알림 파이프라인, 관리자 통제를 10분 이내에 연속 시연한다.
- “거주자 → 층별장 → 관리자” 순으로 단일 데이터가 흐른다는 점을 강조한다.
- 실서비스와 동일한 prod 프로파일(+실제 DB/Redis) 환경에서 데모를 진행해 신뢰를 확보한다.

## 2. 사전 준비

### 2.1 환경 체크리스트
- [ ] 발표 서버에서 `./auto deploy up --build` 실행 (문제 시 `./auto deploy reset --build`로 한 번에 초기화)
- [ ] `deploy/.env.prod` 최신 비밀 값 적용, 필요 시 `ENABLE_TLS=true`+도메인 설정 후 certbot 발급
- [ ] 로컬 환경에서 직접 백엔드를 띄울 경우 `set -a && source deploy/.env.prod && set +a` 후 `./gradlew bootRun` 실행(CORS 등 env 동기화)
- [ ] `./auto deploy status`, `curl /healthz`, `curl /frontend-healthz`로 백엔드/프런트 헬스 확인

### 2.2 계정·데이터 체크리스트
- [ ] 계정 준비: 거주자 `313-1`, 보조 `313-2`, 층별장 `floor_mgr_3f`, 관리자 `admin`
- [ ] 칸 배정표 인쇄 혹은 슬라이드 준비 (냉장 1~3번 / 냉동 1칸)
- [ ] `/admin/seed/fridge-demo` 실행 후 `전시 데모:` 데이터 재주입 (운영 DB 금지)
- [ ] 샘플 검사 1건 실행(폐기 1 + 경고 1) → 알림/정정 테스트용 데이터 확보
- [ ] 필요 시 `POST /fridge/inspections/{id}/actions`로 벌점/폐기 데이터를 미리 추가

### 2.3 장비·네트워크 체크리스트
- [ ] 노트북 1대 + HDMI, 듀얼 모니터(선택) 준비
- [ ] 관리자/층별장/거주자 3개 브라우저 창(층별장은 시크릿 모드) 로그인 상태 유지
- [ ] 멀티 로그인/세션 만료 안내 메시지 사전 점검
- [ ] 네트워크 Failover 대비 로컬 Docker Compose Up 여부 확인

### 2.4 자동화 명령 요약
- `./auto db migrate` : Flyway 마이그레이션 적용 (필요 시 `--repair`)
- `./auto deploy up --build` : 최신 컨테이너 빌드·기동
- `./auto deploy reset --build` : down --volumes → db/redis → migrate → up 순으로 초기화
- `./auto deploy tls issue|renew` : HTTPS 인증서 발급/갱신 (도메인 사용 시)

## 3. 시연 흐름

### 🚀 Dormmate: 최종 시연 시나리오 (A+B)
폴링을 시연을 위하여 6초로 단축했음을 말씀드리기
#### 1단계: 데모 초기 칸 사용 + 즉시 정책 조정 [검증완료]
> 목표: 데모 리셋 시 모든 냉장 칸의 허용량이 10으로 초기화된 상태(점유 수는 층 배정 데이터에 따라 8~10개로 달라질 수 있음)에서 거주자 등록 실패 → 관리자 증량 → 라벨 발급·수정·삭제 → 잘못된 하향 조정 차단까지 연속 확인.  
> 핵심 API/검증: `GET /fridge/slots?view=full`, `POST /fridge/bundles`, `PATCH /fridge/bundles/{bundleId}`, `DELETE /fridge/bundles/{bundleId}`, `PATCH /admin/fridge/compartments/{id}` → `CAPACITY_EXCEEDED`, `bundle_label_sequence`, `CAPACITY_BELOW_ACTIVE`.

* [페르소나] 거주자 (A) / 관리자 (C)
* (시연 멘트)
    "데모 리셋 직후라 제 슬롯의 허용량이 10개로 맞춰져 있습니다. `/fridge/slots?view=full` 응답에서 `maxBundleCount=10`, `occupiedCount` 필드를 보여주고, 현재 점유 수가 허용량과 동일함을 확인합니다."

    *(거주자 A가 11번째 포장을 `POST /fridge/bundles`로 등록 시도 → 422 `CAPACITY_EXCEEDED` 토스트 확인)*

    "이제 관리자 노트북(`/admin/fridge/compartments`)에서 같은 칸을 선택해 `PATCH /admin/fridge/compartments/{id}` 요청으로 `maxBundleCount`를 20으로 올립니다. 정책이 즉시 반영됩니다."

    *(거주자 화면으로 돌아와 동일 등록을 재시도 → 성공, 응답에서 새 라벨이 `bundle_label_sequence`로 발급됨을 강조)*

    "방금 생성한 포장을 `PATCH /fridge/bundles/{id}`로 이름·메모를 바꾸고, `DELETE /fridge/bundles/{id}`로 삭제하면 라벨이 다시 풀(pool)에 돌아가 다음 등록 때 재사용된다는 점도 보여줍니다."

    "마지막으로 관리자가 허용량을 실제 보관량보다 낮은 5개로 설정하려 하면 서버가 `422 CAPACITY_BELOW_ACTIVE`로 차단해, 정책 하향 시에도 데이터 일관성이 보장됨을 확인합니다."

> **운영 노트**  
> `R__demo_reset.sql`이 허용량을 10으로 맞추지만, 실제 보관 수는 층별 배정 인원에 따라 달라질 수 있으므로 시연 전 `occupiedCount` 확인 후 11번째 등록이 실패하도록 데이터를 맞춰 둡니다.

#### 2단계: 검사 시작 (층별장)
> 목표: 검사 세션 생성과 칸 잠금 정책 시연.  
> 핵심 API/검증: `POST /fridge/inspections` → 칸 상태 `IN_INSPECTION`, 30분 잠금.

* [페르소나] 층별장 (B)
* (시연 멘트)
    "이제 B 층별장이 정기 검사를 시작합니다. '검사 시작' 버튼을 누릅니다. (`POST /fridge/inspections`)"

    *(층별장 화면에서 '검사 시작' 클릭)*

    "이 순간, `InspectionService`가 호출되어 냉장고 칸이 30분간 'IN_INSPECTION' 상태로 변경됩니다. 요청 본문에 `scheduleId`를 전달하면 해당 '검사 일정(`InspectionSchedule`)'과 즉시 연결되고, 30분 내 검사를 완료하지 않으면 스케줄러가 세션을 `CANCELLED` 처리해 냉장고가 무한정 잠기는 것을 방지합니다."
    검사 도중 임시저장을 누르고 뒤로가기 눌르고 돌아가면 상태 임시 저장됨
    해당 그날에 모든 검사를 다 못마쳐도 날짜를 뒤로미루면 아직 검사하지 않은 칸들만 뒤로 미루어짐
#### 3단계: 시스템의 견고성 (어-어 패스 1)
> 목표: 잠금 상태에서 거주자 변경 차단.  
> 핵심 API/검증: `POST /fridge/bundles` → `ensureCompartmentNotLocked` = 423 Locked / `COMPARTMENT_LOCKED`, `COMPARTMENT_UNDER_INSPECTION`.

* [페르소나] 거주자 (A)
* (시연 멘트)
    "검사가 시작되자마자 거주자 A의 화면을 다시 보겠습니다. 새로고침을 누르자, API가 `status` 필드를 읽어와 칸에 '검사 중' 배지가 표시되고 '등록' 버튼이 비활성화되었습니다."

    *(거주자 A의 화면을 보여줌. 잠긴 칸에 '등록' 버튼이 비활성화된 것을 강조)*

    "만약 거주자가 이 상태를 무시하고 API로 직접 포장을 등록하려 시도하면, `ensureCompartmentNotLocked` 로직이 `423 Locked + COMPARTMENT_LOCKED` 혹은 검사 중일 때는 `COMPARTMENT_UNDER_INSPECTION` 오류를 반환하며 시스템의 데이터 정합성을 견고하게 지켜줍니다."

#### 4단계: 조치 및 자동화 (층별장)
> 목표: 조치 → 스냅샷 → 벌점 → 잠금 연장 자동화 설명.  
> 핵심 API/검증: `POST /fridge/inspections/{id}/actions` → `inspection_action_item`, `maybeAttachPenalty`.

* [페르소나] 층별장 (B)
* (시연 멘트)
    "다시 층별장 화면입니다. B 층별장이 유통기한이 지난 포장을 발견하고 '폐기(DISPOSE)' 조치를 선택합니다. (`POST /fridge/inspections/{id}/actions`)"

    *(층별장 화면에서 '폐기' 버튼 클릭)*

    "이 클릭 한 번으로, 서버에서는 3가지 핵심 로직이 동시에 실행됩니다.
    1.  모든 조치 내역은 `inspection_action_item` 스냅샷으로 기록됩니다.
    2.  `maybeAttachPenalty`가 호출되어, '폐기' 조치에 대한 벌점(`PenaltyHistory`)이 자동으로 생성됩니다.
    3.  조치가 성공했으므로 잠금 시간이 30분 더 연장됩니다."

    > **운영 노트**  
    > 자동 벌점은 `DISPOSE_EXPIRED`, `UNREGISTERED_DISPOSE` 조치에만 1점이 부과되며, 경고(WARN) 계열은 조치 기록만 남고 벌점은 생성되지 않습니다.


#### 5단계: 제출 및 알림 (거주자)
> 목표: 검사 제출과 알림/배지 반영.  
> 핵심 API/검증: `POST /fridge/inspections/{id}/submit` → `NotificationService.sendInspectionResultNotifications` (dedupe `FRIDGE_RESULT:<sessionId>:<userId>`), `/notifications` 미읽음 우선.

* [페르소나] 층별장 (B) / 거주자 (A)
* (시연 멘트)
    "B 층별장이 검사를 '제출'합니다. (`POST /fridge/inspections/{id}/submit`)"

    *(층별장 화면에서 '제출' 클릭, 거주자 화면으로 전환)*

    "제출 즉시, `NotificationService`가 A 거주자에게 벌점 ID와 조치 내역이 포함된 알림을 발송합니다. `FRIDGE_RESULT:<sessionId>:<userId>` 형태의 dedupe 키로 중복 알림은 모두 차단됩니다."

    *(거주자 화면의 '알림'(/notifications) 아이콘에 배지가 뜨고, 클릭 시 '검사 결과' 알림이 최상단에 보임. 알림을 읽고, 포장 목록으로 돌아가면 검사 이후 수정된 항목을 구분하기 위해 `updatedAfterInspection` 배지가 표시되는 것을 보여줌)*

    > **운영 노트**  
    > `updatedAfterInspection` 배지는 `lastInspectedAt < updatedAt` 인 항목에만 표시되므로, 제출 직후 거주자가 내용을 수정하면 즉시 뱃지가 붙어 검수 이후 변경 여부를 파악할 수 있습니다.

#### 6단계: 관리자 감시 로그에서 권한 불일치 진단 (관리자)
> 목표: 관리자 화면에서 번들 소유자-호실-칸 매핑 오류를 실시간 탐지하고 조치 플로우를 보여준다.  
> 핵심 API/검증: `GET /admin/fridge/issues` → `vw_fridge_bundle_owner_mismatch` 뷰, 감사 로그 페이지 `냉장고 권한 불일치 모니터` 카드, `issueType` 별 대응.

* [페르소나] 관리자 (C)
* (시연 멘트)
    "마지막으로 관리자 화면의 '감사 로그' 탭을 열어 보겠습니다. 상단에 '냉장고 권한 불일치 모니터' 카드가 있고, 백엔드가 1초 내 `GET /admin/fridge/issues`로 최신 데이터를 불러옵니다. 이 API는 Flyway repeatable 스크립트로 정의된 `vw_fridge_bundle_owner_mismatch` 뷰를 그대로 읽어, 소유자-호실 배정이 끊겼거나 접근 권한이 없는 칸에 번들이 남아있는 경우만 필터링합니다."

    *(관리자 페이지에서 권한 불일치 테이블을 보여주고, `issueType` 배지·라벨·칸 정보·업데이트 시각을 짚어가며 설명)*

    "리스트에서 `ROOM_NOT_ALLOWED_FOR_COMPARTMENT` 항목을 클릭하면 해당 번들을 `/admin/fridge` 화면에서 바로 찾아 소유자 이관이나 칸 재배분을 진행합니다. `NO_ACTIVE_ROOM_ASSIGNMENT` 라벨은 `room_assignment` 레코드가 끊긴 상태라서, 관리자나 층별장이 실제 거주 여부를 확인해 방 배정을 복원하거나 포장을 회수하면 됩니다."

> **운영 노트**  
> - `R__fridge_views.sql`에 정의된 뷰는 Flyway repeatable 이므로 배포 시 자동으로 최신 정의가 반영됩니다.  
> - 시연 전 `SELECT * FROM vw_fridge_bundle_owner_mismatch LIMIT 5;`를 실행해 의도적으로 1~2건의 데이터(예: room_assignment.release 처리, 허용 칸이 다른 호실에 남아있는 번들)를 만들어 두면 데모 중 리스트가 비지 않습니다.  
> - 로깅/감시와 연계할 때는 `issue_type`, `bundle_id`, `updated_at`을 기준으로 슬랙/이메일 알림을 보낼 수 있도록 status-board에 항목을 추가해 둡니다.

#### 6단계: 관리자의 강력한 운영 도구
> 목표: 재배분·정정 등 운영 액션과 감사 로그 확인.  
> 핵심 API/검증: `POST /admin/fridge/reallocations/preview|apply`, `PATCH /fridge/inspections/{id}` (정정), AuditLog `FRIDGE_REALLOCATION_APPLY`.

* [페르소나] 관리자 (C)
* (시연 멘트)
    "관리자는 시스템을 총괄합니다. 예를 들어, '호실 재배분'(`reallocations/preview`)을 실행하면, 검사 중인 칸은 '경고(warning)'로 표시하며 안전하게 배정안을 시뮬레이션할 수 있습니다."

    *(관리자 화면에서 '호실 재배분' 미리보기와 적용을 시연)*

    "또한, 어제 층별장이 실수로 부과한 벌점을 수정해야 한다면, '검사 내역'에서 `PATCH /fridge/inspections/{id}`를 호출하여 조치 내역을 '정정(ADJUST)'할 수도 있습니다."

    > **운영 노트**  
    > `apply` 요청에 포함된 칸 중 하나라도 잠겨 있거나 검사 중이면 API가 전체 요청을 `COMPARTMENT_IN_USE`로 거절하므로, 실행 전에 `/fridge/inspections/active`로 검사 상태를 확인하거나 해당 칸을 제외하고 재요청합니다.

#### 7단계: 배치 작업 및 최종 추적
> 목표: 배치 알림과 감사 추적 시연.  
> 핵심 API/검증: `FridgeExpiryNotificationScheduler` (09:00 cron) → `notification_dispatch_log`, `AuditLog` (`INSPECTION_SUBMIT`, `FRIDGE_REALLOCATION_APPLY` 등).

* [페르소나] 관리자 (C)
* (시연 멘트)
    "보이지 않는 영역도 관리됩니다. 매일 아침 9시, `FridgeExpiryNotificationScheduler`가 실행되어 유통기한 임박 알림을 보냅니다. 관리자는 `notification_dispatch_log`에서 배치별 `SUCCESS/FAILED` 기록과 오류 코드를 추적할 수 있습니다."

    *(관리자 화면에서 'AuditLog' 조회)*

    "그리고 오늘 시연한 모든 핵심 행위들—'층별장의 검사 제출', '자동 벌점 부과', '관리자의 재배분'—이 '감사 로그(AuditLog)'에 `INSPECTION_SUBMIT`, `FRIDGE_REALLOCATION_APPLY`, `FRIDGE_DEMO_SEED_EXECUTED` 같은 타입과 JSON 상세 내역으로 모두 기록되었습니다. 이것이 수기 관리의 비대칭 문제를 해결하는 Dormmate의 핵심입니다."

#### 8단계: 데모 리셋 (마무리)
> 목표: 데모 데이터를 초기 상태로 재구성하고 감사 로그 남김.  
> 핵심 API/검증: `POST /admin/seed/fridge-demo` → `FRIDGE_DEMO_SEED_EXECUTED`.

* [페르소나] 관리자 (C)
* (시연 멘트)
    "시연을 마치기 전, 이 모든 데이터를 초기화하고 싶다면 관리자는 `/admin/seed/fridge-demo` API를 호출합니다. 이 API는 SQL 스크립트를 실행하여 지금 보신 모든 데이터를 데모용 초기 상태로 되돌리고, 이 실행 기록 또한 감사 로그에 남깁니다. 감사합니다."

#### 9단계: 멀티 로그인 (편의성 + 보안) [검증완료]
> 목표: 사용자 편의성 유지 + `deviceId` 기반 세션 보안.  
> 핵심 API/검증: `POST /auth/login`, `POST /auth/refresh` → `DEVICE_MISMATCH`.

* [페르소나] 거주자 (A), 층별장 (B)
* (시연 멘트)
    "마무리로, 두 사용자가 서로 다른 기기(PC/모바일)에서 동시에 로그인하더라도 세션이 유지되는 모습을 보여드리겠습니다."

    *(PC와 모바일(다른 브라우저)로 각각 로그인하는 모습을 다시 보여줌)*

    "멀티 로그인을 허용해 편의성을 유지하되, 만약 리프레시 토큰(dm.auth.tokens)이 탈취되어 다른 기기에서 사용되면 서버가 `deviceId` 불일치를 감지(DEVICE_MISMATCH)하고 즉시 세션을 폐기합니다. 이렇게 편의와 보안을 모두 잡았습니다."

    > **운영 노트**  
    > "현재 access token TTL은 45초, refresh 토큰은 5분으로 운용해 사용자가 거의 즉시 `/auth/refresh`를 거치도록 강제하고 있습니다. refresh 시마다 `deviceId`를 재검증해 두 세션을 동시에 끊고, 추후에는 IP/위치 검증과 세션·하드웨어 인증을 연계해 방어를 확장할 계획입니다."
    >
> 데모에서 `DEVICE_MISMATCH`를 재현하려면 브라우저마다 서로 다른 `deviceId`(로컬 스토리지 `dm.device.id`)를 유지한 상태에서 한쪽의 `refreshToken`만 다른 기기에 붙여 넣고 `/auth/refresh`를 호출하면 됩니다. 토큰과 기기 ID가 묶여 있기 때문에 refresh 토큰만 탈취해도 서버가 즉시 모든 세션을 폐기합니다.

브라우저 A에서 로그인한 뒤 개발자 도구 → Application → Local Storage → 해당 도메인으로 가보면 `dm.auth.tokens`와 `dm.device.id` 항목이 있습니다. refresh 토큰만 다른 기기에 붙여 저장하고 새로고침하면 서버가 `deviceId` 불일치를 감지하고 두 세션을 동시에 끊습니다.
