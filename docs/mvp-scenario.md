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

#### 1단계: 멀티 로그인 (편의성 + 보안)
> 목표: 사용자 편의성 유지 + `deviceId` 기반 세션 보안.  
> 핵심 API/검증: `POST /auth/login`, `POST /auth/refresh` → `DEVICE_MISMATCH`.

* [페르소나] 거주자 (A), 층별장 (B)
* (시연 멘트)
    "두 사용자가 있습니다. B는 원칙을 중시하는 FM 층별장, A는 규칙을 잘 잊는 거주자입니다. 두 사용자 모두 PC와 모바일에서 로그인합니다."

    *(PC와 모바일(다른 브라우저)로 각각 로그인하는 모습을 보여줌)*

    "보시다시피 PC로 로그인해도 모바일 세션이 끊기지 않습니다. 멀티 로그인을 허용해 사용자 편의성을 높였습니다. 하지만 만약 리프레시 토큰(dm.auth.tokens)이 탈취되어 다른 기기에서 사용되면, 서버가 `deviceId` 불일치를 감지(DEVICE_MISMATCH)하고 즉시 세션을 폐기합니다. 이것이 저희의 '편의와 보안'을 모두 잡은 첫 번째 포인트입니다."

브라우저 A에서 로그인한 뒤 개발자 도구 → Application → Local Storage → 해당 도메인으로 가보면 dm.auth.tokens 항목이 있고, 여기서 refreshToken을 확인할 수 있습니다.
이걸 다른 기기에 붙여 저장하고 새로고침해서 
#### 2단계: 거주자 평소 화면 (기능 확인)
> 목표: 슬롯 메타 정보와 라벨 자동 발급 정책 확인.  
> 핵심 API/검증: `GET /fridge/slots?view=full`, `POST /fridge/bundles` → `bundle_label_sequence`.

* [페르소나] 거주자 (A)
* (시연 멘트)
    "먼저 거주자 A의 화면입니다. `/fridge/slots?view=full` API를 통해 본인에게 배정된 칸을 봅니다. 지금은 'ACTIVE' 상태이고, '최대 10개'(`max_bundle_count`)까지 보관 가능하다고 나옵니다. 여기에 포장을 하나 등록해 보겠습니다."

    *(거주자 A, 포장 1개 등록. 'A-101' 같은 라벨이 자동 발급되는 것을 보여줌)*

    "이렇게 `bundle_label_sequence`를 통해 라벨이 자동 발급되며, 만약 이 포장을 삭제하면 이 라벨은 재사용 가능한 상태로 돌아갑니다. 데모 기본 허용량이 10개이기 때문에, 10개를 모두 채운 뒤 11번째를 등록하면 `422 CAPACITY_EXCEEDED` 오류가 발생하는 것도 함께 보여줍니다. 이 제한은 관리자 단계에서 정책적으로 상향 조정할 수 있고, 그 흐름은 7단계에서 이어집니다."

#### 3단계: 검사 시작 (층별장)
> 목표: 검사 세션 생성과 칸 잠금 정책 시연.  
> 핵심 API/검증: `POST /inspections/start` → 칸 상태 `IN_INSPECTION`, 30분 잠금.

* [페르소나] 층별장 (B)
* (시연 멘트)
    "이제 B 층별장이 정기 검사를 시작합니다. '검사 시작' 버튼을 누릅니다. (`POST /inspections/start`)"

    *(층별장 화면에서 '검사 시작' 클릭)*

    "이 순간, `InspectionService`가 호출되어 냉장고 칸이 30분간 'IN_INSPECTION' 상태로 변경됩니다. 이 세션은 등록된 '검사 일정(`InspectionSchedule`)'과 자동으로 연결되며, 만약 30분 내 검사를 못 마치면 스케줄러가 세션을 `CANCELLED` 처리하여 냉장고가 무한정 잠기는 것을 방지합니다."

#### 4단계: 시스템의 견고성 (어-어 패스 1)
> 목표: 잠금 상태에서 거주자 변경 차단.  
> 핵심 API/검증: `POST /fridge/bundles` → `ensureCompartmentNotLocked` = 423 Locked / COMPARTMENT_LOCKED.

* [페르소나] 거주자 (A)
* (시연 멘트)
    "검사가 시작되자마자 거주자 A의 화면을 다시 보겠습니다. 새로고침을 누르자, API가 `status` 필드를 읽어와 칸에 '검사 중' 배지가 표시되고 '등록' 버튼이 비활성화되었습니다."

    *(거주자 A의 화면을 보여줌. 잠긴 칸에 '등록' 버튼이 비활성화된 것을 강조)*

    "만약 거주자가 이 상태를 무시하고 API로 직접 포장을 등록하려 시도하면, `ensureCompartmentNotLocked` 로직이 `423 Locked + COMPARTMENT_LOCKED` 오류를 반환하며 시스템의 데이터 정합성을 견고하게 지켜줍니다."

#### 5단계: 조치 및 자동화 (층별장)
> 목표: 조치 → 스냅샷 → 벌점 → 잠금 연장 자동화 설명.  
> 핵심 API/검증: `POST /inspections/{id}/actions` → `inspection_action_item`, `maybeAttachPenalty`.

* [페르소나] 층별장 (B)
* (시연 멘트)
    "다시 층별장 화면입니다. B 층별장이 유통기한이 지난 포장을 발견하고 '폐기(DISPOSE)' 조치를 선택합니다. (`POST /inspections/{id}/actions`)"

    *(층별장 화면에서 '폐기' 버튼 클릭)*

    "이 클릭 한 번으로, 서버에서는 3가지 핵심 로직이 동시에 실행됩니다.
    1.  모든 조치 내역은 `inspection_action_item` 스냅샷으로 기록됩니다.
    2.  `maybeAttachPenalty`가 호출되어, '폐기' 조치에 대한 벌점(`PenaltyHistory`)이 자동으로 생성됩니다.
    3.  조치가 성공했으므로 잠금 시간이 30분 더 연장됩니다."

#### 6단계: 제출 및 알림 (거주자)
> 목표: 검사 제출과 알림/배지 반영.  
> 핵심 API/검증: `POST /inspections/{id}/submit` → `NotificationService.sendInspectionResultNotifications` (dedupe `FRIDGE_RESULT:<session>:<user>`), `/notifications` 미읽음 우선.

* [페르소나] 층별장 (B) / 거주자 (A)
* (시연 멘트)
    "B 층별장이 검사를 '제출'합니다. (`POST /inspections/{id}/submit`)"

    *(층별장 화면에서 '제출' 클릭, 거주자 화면으로 전환)*

    "제출 즉시, `NotificationService`가 A 거주자에게 벌점 ID와 조치 내역이 포함된 알림을 발송합니다. `dedupe` 키로 중복 알림은 모두 차단됩니다."

    *(거주자 화면의 '알림'(/notifications) 아이콘에 배지가 뜨고, 클릭 시 '검사 결과' 알림이 최상단에 보임. 알림을 읽고, 포장 목록으로 돌아가면 검사 이후 수정된 항목을 구분하기 위해 `updatedAfterInspection` 배지가 표시되는 것을 보여줌)*

#### 7단계: 관리자의 검증 (어-어 패스 2)
> 목표: 관리자 설정 변경으로 정책을 조정하고, 잘못된 값은 서버가 차단함을 시연.  
> 핵심 API/검증: `PATCH /admin/fridge/compartments/{id}` → `CAPACITY_BELOW_ACTIVE` 보호, 허용량 상향 후 거주자 재등록.

* [페르소나] 관리자 (C) / 거주자 (A)
* (시연 멘트)
    "관리자는 시스템이 규정대로 작동하는지 검증하면서, 필요한 경우 정책도 조정합니다. 먼저, 현재 10개가 들어 있는 칸을 `max_bundle_count = 5`로 낮추려고 하면 `422 UNPROCESSABLE ENTITY (CAPACITY_BELOW_ACTIVE)`가 나와 잘못된 설정을 서버가 차단한다는 점을 보여줍니다."

    *(관리자 화면(`/admin/fridge/compartments`)에서 허용량을 5로 낮추는 시도 → 오류 토스트/알림)*

    "이번 데모에서는 거주자가 10개를 꽉 채운 뒤 11번째 등록이 막혔으므로, 관리자가 해당 칸의 허용량을 20으로 올립니다. (`PATCH /admin/fridge/compartments/{id}`, payload: `{ \"maxBundleCount\": 20 }`)"

    *(관리자가 허용량을 20으로 조정한 뒤, 거주자 화면으로 돌아가 등록을 재시도하면 성공하는 장면을 보여줌)*

    "이렇게 관리자는 정책을 올바르게 증분하는 방식으로 제어할 수 있고, 거주자는 즉시 등록 가능해집니다."

#### 8단계: 관리자의 강력한 운영 도구
> 목표: 재배분·정정 등 운영 액션과 감사 로그 확인.  
> 핵심 API/검증: `POST /admin/fridge/reallocations/preview|apply`, `PATCH /inspections/{id}` (정정), AuditLog `FRIDGE_REALLOCATION_APPLY`.

* [페르소나] 관리자 (C)
* (시연 멘트)
    "관리자는 시스템을 총괄합니다. 예를 들어, '호실 재배분'(`reallocations/preview`)을 실행하면, 검사 중인 칸은 '경고(warning)'로 표시하며 안전하게 배정안을 시뮬레이션할 수 있습니다."

    *(관리자 화면에서 '호실 재배분' 미리보기와 적용을 시연)*

    "또한, 어제 층별장이 실수로 부과한 벌점을 수정해야 한다면, '검사 내역'에서 `PATCH /inspections/{id}`를 호출하여 조치 내역을 '정정(ADJUST)'할 수도 있습니다."

#### 9단계: 배치 작업 및 최종 추적
> 목표: 배치 알림과 감사 추적 시연.  
> 핵심 API/검증: `FridgeExpiryNotificationScheduler` (09:00 cron) → `notification_dispatch_log`, `AuditLog` (`INSPECTION_SUBMIT`, `FRIDGE_REALLOCATION_APPLY` 등).

* [페르소나] 관리자 (C)
* (시연 멘트)
    "보이지 않는 영역도 관리됩니다. 매일 아침 9시, `FridgeExpiryNotificationScheduler`가 실행되어 유통기한 임박 알림을 보냅니다. 관리자는 `notification_dispatch_log`에서 이 배치 작업이 'SUCCESS'했는지, 혹은 특정 사용자에게 'FAILED'했는지 모두 추적할 수 있습니다."

    *(관리자 화면에서 'AuditLog' 조회)*

    "그리고 오늘 시연한 모든 핵심 행위들—'층별장의 검사 제출', '자동 벌점 부과', '관리자의 재배분'—이 '감사 로그(AuditLog)'에 `FRIDGE_REALLOCATION_APPLY` 같은 타입과 JSON 상세 내역으로 모두 기록되었습니다. 이것이 수기 관리의 비대칭 문제를 해결하는 Dormmate의 핵심입니다."

#### 10단계: 데모 리셋 (마무리)
> 목표: 데모 데이터를 초기 상태로 재구성하고 감사 로그 남김.  
> 핵심 API/검증: `POST /admin/seed/fridge-demo` → `FRIDGE_DEMO_SEED_EXECUTED`.

* [페르소나] 관리자 (C)
* (시연 멘트)
    "시연을 마치기 전, 이 모든 데이터를 초기화하고 싶다면 관리자는 `/admin/seed/fridge-demo` API를 호출합니다. 이 API는 SQL 스크립트를 실행하여 지금 보신 모든 데이터를 데모용 초기 상태로 되돌리고, 이 실행 기록 또한 감사 로그에 남깁니다. 감사합니다."
