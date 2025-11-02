# DormMate 냉장고 MVP 구현 계획
*용도: [mvp-scenario.md](mvp-scenario.md) 범위를 시나리오 단위 작업 블록으로 정리한 체크리스트다. 각 블록은 [docs/ops/status-board.md](ops/status-board.md)에서 WIP/DONE을 추적할 수 있는 Status ID와 연결된다.*

> 목적: 시연 플로우를 안정적으로 구현하면서도 확장 대비 코드를 보존하기 위해, 백엔드·프런트·테스트 관점의 핵심 작업을 시나리오 흐름 순서대로 정의한다.

## 사용 가이드
- 진행·기록 상세 절차는 [docs/ops/status-board.md](ops/status-board.md)를 따른다.
- 참고의 [mvp-scenario.md](mvp-scenario.md)에서 실제 구현해야할 시나리오 단계(S0~S5, SX)를 확인하고 아래 Status ID를 사용자에게 재진술해 합의한다.
- 각 Status 착수 전 [mvp-scenario.md](mvp-scenario.md) 해당 절과 [feature-inventory.md](feature-inventory.md) 연결 섹션(본문 *관련 문서* 링크)을 모두 읽고, 이해한 근거를 [docs/ops/status-board.md](ops/status-board.md)에 명시한다.
- **착수 전 공통 스캔 루틴** – 어떤 Status든 시작하기 전에 아래 자료를 순서대로 훑어보고 핵심 포인트를 메모한다.
  1. [mvp-scenario.md](mvp-scenario.md)에서 해당 시나리오 구간을 확인해 전체 흐름과 데모 요구사항을 정리한다.
  2. [feature-inventory.md](feature-inventory.md)에서 모듈별 정책·예외·상태 정의를 찾아 코드/테스트에 반영할 체크리스트를 만든다.
  3. [data-model.md](data-model.md)에서 연관 테이블·필드·상태값을 리뷰하고, 관련 마이그레이션/도메인 엔티티 파일 위치를 메모한다.
  4. 필요 시 [docs/ai-impl/backend.md](ai-impl/backend.md), [docs/ai-impl/frontend.md](ai-impl/frontend.md)의 구현 지침과 기존 [docs/ops/status-board.md](ops/status-board.md) 로그를 참고해 이전 결정 사항을 상기한다.
  5. 상기 내용을 [docs/ops/status-board.md](ops/status-board.md) WIP 섹션에 근거로 기록한 뒤 구현에 착수한다.
- UI를 생성·수정할 때는 **모바일 포함 다양한 기기에서 최적화된 레이아웃과 상호작용**을 먼저 점검하고, 사용자 경험을 최우선으로 고려해 반응형 디자인·접근성·터치 인터랙션 등을 테스트한다. (지침: [docs/ai-impl/frontend.md](ai-impl/frontend.md))
- UI 변경 필요성이 보이면 우선 다른 작업을 마무리한 뒤 사용자에게 변경 제안을 제출한다. (지침: [docs/ai-impl/frontend.md](ai-impl/frontend.md))
- 확장 대비 코드(다중 검사자, 알림 정책 UI 등)는 삭제하지 말고, 필요 시 주석과 문서로 현재 비활성 상태임을 명시한다. (지침: [docs/ai-impl/backend.md](ai-impl/backend.md), [docs/ai-impl/frontend.md](ai-impl/frontend.md))
- 정책·데이터 모델이 불명확할 때는 [feature-inventory.md](feature-inventory.md), [data-model.md](data-model.md)를 교차 참고해 문서를 업데이트한다.
- API·스키마를 수정할 때는 코드뿐 아니라 `api/openapi.yml`과 관련 문서(플랜/시나리오/인벤토리)를 함께 갱신한다.
- 이 문서의 체크리스트는 기능 구현을 위한 **최소 요구사항**만 기술한다. 실제 개발 시에는 각 Status의 *Feature 링크*를 따라가 [feature-inventory.md](feature-inventory.md) 원문과 연계 문서를 충분히 이해한 뒤, 필요한 세부 기능/예외/테스트 항목을 이 플랜에 확장 기록하면서 구현한다.
- “Stretch” 표시(Status 예: IN-306)는 MVP 완료 후 시간 여유가 있을 때 진행하며, 상태 보드에는 Backlog/차기 일정으로 구분한다.

## S0 공통 준비 (mvp-scenario.md §2)

### EN-101 환경 베이스라인
- **Status ID**: EN-101
- **체크리스트**
  - [x] Gradle 모듈·패키지 스켈레톤 정리 및 핵심 의존성 버전 고정(`build.gradle`, plugins/dependencyManagement 버전 확인).
  - [x] `./auto tests backend`, `./auto dev warmup` 명령 경로 확인 및 통합 테스트 기본 픽스처 구성.
- **목표**: 모든 작업자가 동일한 빌드/테스트 명령으로 환경을 재현할 수 있다.
- **참고**: [docs/ai-impl/backend.md](ai-impl/backend.md), [docs/ai-impl/frontend.md](ai-impl/frontend.md)

### EN-102 데이터 베이스라인
- **Status ID**: EN-102
- **체크리스트**
  - [x] Flyway 베이스라인과 전시용 데모 시드(`db/demo/fridge_exhibition_items.sql`) 자동화를 검증하고 롤백 절차를 문서화.
  - [x] 데모 환경 `.env`·Docker Compose 구성 정리 및 비상 전환 플랜(mvp-scenario.md §4) 기록.
- **목표**: 데모/로컬 환경에서 동일한 데이터로 기동·롤백을 수행할 수 있다.
- **참고**: [mvp-scenario.md §2](mvp-scenario.md#2-사전-준비), [feature-inventory.md §2](feature-inventory.md#2-냉장고--일반-기숙사생)

### EN-103 인증/세션 연동 — DONE (2025-11-02, Codex)
- **Status ID**: EN-103
- **체크리스트**
  - [x] `frontend/lib/api-client.ts`에서 401 응답 시 자동 refresh·재시도 후 실패하면 로그인 화면으로 리다이렉트하도록 정리.
  - [x] 프런트에서 `deviceId`를 1회 생성해 로그인/refresh 요청마다 전송, 백엔드 `user_session.device_id` 정책과 동기화.
  - [x] 냉장고 초기 데이터 로딩이 401/403 응답을 사용자 메시지로 안내하고, 세션 만료 시 로그인 카드에서 사유를 노출.
- **목표**: 실사용 환경과 동일한 인증·세션 동작을 MVP에서도 보장한다.
- **참고**: [docs/ops/status-board.md](ops/status-board.md#auth-201-로그인세션-안정화)


### AU-103 재설정·감사 로그
- **Status ID**: AU-103
- **상태**: Post-MVP 이월 과제
- **체크리스트**
  - [ ] 비밀번호 재설정/초기화 흐름과 감사 로그 기능은 MVP 이후 일정에서 구현한다는 점을 상태 보드에 명시한다.
  - [ ] 후속 작업 시 `user_session` 전량 폐기, 감사 로그 보존 정책, 관리자 조회 API 요구사항을 재정리한다.
  - [ ] 관련 테스트/문서 TODO를 `docs/ops/status-board.md` Backlog에 남겨 추후 착수 시 참조한다.
- **Feature 링크**: [Feature Inventory §1 계정 및 권한](feature-inventory.md#1-계정-및-권한)
- **목표**: 실무 운영에 필요한 계정 복구·감사 추적 기능을 제공한다.
- **참고**: [feature-inventory.md §1](feature-inventory.md#1-계정-및-권한), [feature-inventory.md §6](feature-inventory.md#6-phase-2-모듈-개요-참고)

---

## S1 거주자 포장 관리 (mvp-scenario.md §3.1)

### FR-201 슬롯 접근 제어
- **Status ID**: FR-201
- **체크리스트**
  - [x] `GET /fridge/slots`가 배정 칸만 반환하는지 검증(`FridgeService#getSlots`).
  - [x] 프런트 슬롯 선택 UX가 배정 칸만 표시하도록 API 파라미터/필터를 적용.
  - [x] 운영 계정 시드와 라벨 시퀀스 초기화 상태를 점검하고 필요 시 관리자 도구에서 재적용한다.
  - [x] `GET /fridge/slots?view=full&page=0&size=20` 응답에서 `occupiedCount`·총 개수 등이 포함되고, 프런트 슬롯 목록이 해당 값으로 페이지네이션/잔여 용량을 계산하는지 확인한다.
- **Feature 링크**: [Feature Inventory §2 냉장고 – 일반 기숙사생](feature-inventory.md#2-냉장고--일반-기숙사생)
- **목표**: 거주자가 자신의 칸만 선택해 등록을 시작할 수 있다.
- **참고**: [data-model.md §4](data-model.md#4-냉장고-도메인), [mvp-scenario.md §3.1](mvp-scenario.md#31-거주자-포장-등록-및-관리)

### FR-202 포장 등록 플로우
- **Status ID**: FR-202
- **체크리스트**
  - [x] `POST /fridge/bundles`에서 `max_bundle_count` 초과 시 422(`CAPACITY_EXCEEDED`)가 반환되는지 확인.
  - [x] 포장 등록 폼의 수량·유통기한 검증과 등록 후 목록/검색 즉시 갱신을 구현.
    - [x] 칸 상태 비활성화(HTTP 423 `COMPARTMENT_SUSPENDED`) 응답 시 접근 차단 메시지를 노출.
  - [x] 포장 등록 후 슬롯/포장 목록이 `occupiedCount` 재계산과 페이지네이션(`page`,`size`) 이동으로 즉시 반영되는지 확인한다.
- **Feature 링크**: [Feature Inventory §2 냉장고 – 일반 기숙사생](feature-inventory.md#2-냉장고--일반-기숙사생)
- **목표**: 거주자가 제한된 용량 안에서 포장을 생성하고 즉시 결과를 확인한다.
- **참고**: [mvp-scenario.md §3.1](mvp-scenario.md#31-거주자-포장-등록-및-관리) 1~4단계 시나리오 최종 구현이 목표

### FR-203 임박/만료 · 라벨 재사용
- **Status ID**: FR-203
- **체크리스트**
  - [ ] `PATCH/DELETE /fridge/items/{id}` 소프트 삭제 후 라벨 재사용(`bundle_label_sequence`)을 검증.
  - [ ] 임박/만료 배지를 `freshness`(`ok/expiring/expired`) 기반으로 통합 표시하고 UI 문구·색상을 정책에 맞춰 조정.
  - [ ] `FridgeIntegrationTest` 및 `npm test -- fridge-badge`로 임박/만료·라벨 플로우 회귀 테스트.
  - [ ] 라벨 시퀀스 기본 범위(001~999) 및 `max_bundle_count` 관리자 조정 정책을 서버 단에서 검증하고 통합 테스트로 보호.
  - [x] 냉장고 증설 시 `compartment_room_access` 자동 재배분 로직을 구현하고, 호실 매핑이 기대대로 변경되는지 검증한다.
  - [ ] 포장 목록 페이징(`page`,`size`)과 `freshness` 필터가 조합될 때도 라벨 재사용·배지 상태가 일관되는지 QA 체크리스트를 확정한다.
- **Feature 링크**: [Feature Inventory §2 냉장고 – 일반 기숙사생](feature-inventory.md#2-냉장고--일반-기숙사생)
- **목표**: 임박/만료 상태가 즉시 반영되고 삭제 후 라벨을 재사용할 수 있다.
- **참고**: [mvp-scenario.md §3.1](mvp-scenario.md#31-거주자-포장-등록-및-관리) 5~6단계 시나리오 최종 구현이 목표

### FR-204 검사 후 수정 추적·벌점 안내
- **Status ID**: FR-204
- **체크리스트**
  - [ ] 거주자 목록에서 검사 이후 수정된 물품을 필터링/배지로 표시하고 `updatedAfterInspection` 플래그를 일관되게 사용.
  - [ ] 폐기/경고 조치가 발생한 포장에 대해 벌점 안내·기록 모듈과 연동하고, 거주자 화면에서 누적 벌점을 노출.
  - [ ] 검사 결과 후 수정·벌점 안내 흐름을 통합/Playwright 테스트로 검증.
  - [ ] 포장/슬롯 목록 UI 문구(임박/만료 배지, 메모 비공개 안내 등)를 최신 정책과 일치하도록 정비하고 스냅샷을 갱신한다.
  - [ ] `inspection_action_item` 스냅샷과 `penalty_history` 누적 정보를 `correlationId`로 연결해 알림/상세 화면에 노출하고, API 스키마 변경사항을 프런트 타입 정의에 반영한다.
- **Feature 링크**: [Feature Inventory §2 냉장고 – 일반 기숙사생](feature-inventory.md#2-냉장고--일반-기숙사생), [Feature Inventory §3 냉장고 – 알림 & 일정](feature-inventory.md#3-냉장고--알림--일정)
- **목표**: 검사 이후 변경된 물품과 벌점 안내가 거주자 화면에서 명확히 드러난다.
- **참고**: [mvp-scenario.md §3.3](mvp-scenario.md#33-검사-후-사용자-알림)

### FR-205 데이터 시드
- **Status ID**: FR-205
- **체크리스트**
  - [x] `/admin/seed/fridge-demo` 관리자 API가 전시용 물품 시드를 교체하는 방식으로 동작하도록 정비하고, Flyway 정적 시드 의존을 제거한다.
  - [x] 전시·데모 데이터 초기화 절차를 `docs/mvp-scenario.md`와 [docs/ops/README.md](ops/README.md)에 문서화하고 경고 문구를 반복 노출한다.
  - [ ] 운영/테스트 환경별로 필요한 추가 초기 데이터가 있다면 관리자 도구 또는 별도 API로 확장할 계획을 정리하고, 상태 보드에 TODO로 남긴다.
- **Feature 링크**: [Feature Inventory §2 냉장고 – 일반 기숙사생](feature-inventory.md#2-냉장고--일반-기숙사생), [Feature Inventory §4 냉장고 – 층별장(검사자)](feature-inventory.md#4-냉장고--층별장검사자)
- **목표**: 운영 환경에서 직접 DB를 수정하지 않고 초기 데이터를 준비/갱신할 수 있다.
- **참고**: [mvp-scenario.md §2](mvp-scenario.md#2-사전-준비)

---

## S2 층별장 검사 세션 (mvp-scenario.md §3.2)

### IN-301 검사 시작·잠금
- **Status ID**: IN-301
- **체크리스트**
  - [ ] `POST /fridge/inspections` 접근 권한(층별장/관리자) 검증 및 세션 생성.
  - [ ] 세션 시작 시 칸 잠금(`FridgeCompartment.locked`, `lockedUntil`) 적용을 검증하고, 기존 세션이 강제 종료된 뒤 신규 세션을 열 때 403 오류가 발생하지 않도록 예외 처리를 보완한다.
  - [ ] 프런트 검사 관리 페이지에서 잠금 상태 표시와 거주자 화면 버튼 비활성화를 구현하고, 자동/수동 로컬 Draft 저장·정리 흐름이 정상 동작하는지 확인한다.
- **Feature 링크**: [Feature Inventory §4 냉장고 – 층별장(검사자)](feature-inventory.md#4-냉장고--층별장검사자)
- **목표**: 검사 시작 시 칸이 잠기고 다른 사용자에게도 잠금 상태가 반영된다.
- **참고**: [mvp-scenario.md §3.2](mvp-scenario.md#32-층별장-검사-세션-단독-흐름) 1~2단계 시나리오 최종 구현이 목표

### IN-302 조치 선택·벌점 연동
- **Status ID**: IN-302
- **체크리스트**
  - [ ] `POST /fridge/inspections/{id}/actions`로 PASS/WARN/DISPOSE/UNREGISTERED_DISPOSE 조치를 저장.
  - [ ] DISPOSE 조치 시 Penalty 도메인으로 벌점 1점 누적 이벤트가 발행되는지 검증하고, 경고/폐기 통계 및 검사 결과 알림과 연동되는지 단위/통합 테스트를 작성한다.
  - [ ] 프런트 조치 UI에서 액션 코드 매핑과 미등록 물품 입력 플로우를 구현한다. 실시간 동기화(SSE)는 Post-MVP 확장(IN-306)으로 이월하고, 현재는 단독 검사 흐름 안정화에 집중한다.
- **Feature 링크**: [Feature Inventory §4 냉장고 – 층별장(검사자)](feature-inventory.md#4-냉장고--층별장검사자), [Feature Inventory §3 냉장고 – 알림 & 일정](feature-inventory.md#3-냉장고--알림--일정)
- **목표**: 층별장이 조치별로 기록을 남기고 폐기 시 벌점이 즉시 반영된다.
- **참고**: [mvp-scenario.md §3.2](mvp-scenario.md#32-층별장-검사-세션-단독-흐름) 3~4단계 시나리오 최종 구현이 목표

### IN-303 제출 요약·잠금 해제
- **Status ID**: IN-303
- **체크리스트**
  - [ ] `POST /fridge/inspections/{id}/submit`에서 통계 집계와 잠금 해제를 검증.
  - [ ] 제출 시 경고/폐기/총 포장 수 요약을 모달 또는 토스트로 표시.
  - [ ] Playwright/수동 테스트로 제출 후 잠금 해제와 거주자 UI 복구를 확인.
- **Feature 링크**: [Feature Inventory §4 냉장고 – 층별장(검사자)](feature-inventory.md#4-냉장고--층별장검사자)
- **목표**: 검사 완료 시 결과 요약을 보여주고 칸이 다시 편집 가능해진다.
- **참고**: [mvp-scenario.md §3.2](mvp-scenario.md#32-층별장-검사-세션-단독-흐름) 5~6단계 시나리오 최종 구현이 목표

### IN-304 거주자 검사 열람 뷰
- **Status ID**: IN-304
- **체크리스트**
  - [ ] 거주자 권한으로 `/fridge/inspections` 접근 시 본인에게 배정된 칸의 검사 일정/이력을 반환하도록 API 접근 제어를 확장한다.
  - [ ] `GET /fridge/inspections`·`/fridge/inspections/{id}` 호출 시 권한 없는 칸은 403(`FORBIDDEN_SLOT`)이 유지되고, 정상 열람 시 200이 반환되는지 통합 테스트를 추가한다.
  - [ ] 프런트 검사 페이지에서 거주자 계정은 진행 현황/요약만 열람하고 검사 시작·조치 버튼이 비활성화되도록 UX를 분기한다.
  - [ ] 거주자 열람 흐름에 대한 수동 또는 Playwright 검증 로그를 [docs/ops/status-board.md](ops/status-board.md)에 기록한다.
- **Feature 링크**: [Feature Inventory §2 냉장고 – 일반 기숙사생](feature-inventory.md#2-냉장고--일반-기숙사생), [Feature Inventory §4 냉장고 – 층별장(검사자)](feature-inventory.md#4-냉장고--층별장검사자)
- **목표**: 거주자가 자신의 칸 검사 일정과 결과를 확인하되 검사 실행 권한은 유지되지 않는다.
- **참고**: [mvp-scenario.md §3.2](mvp-scenario.md#32-층별장-검사-세션-단독-흐름)

### IN-305 검사 벌점 도메인 연동
- **Status ID**: IN-305
- **체크리스트**
  - [ ] 검사 조치(`WARN_*`, `DISPOSE_*`) 발생 시 벌점 엔티티에 누적·해제 이벤트를 기록하고 DormMate 알림으로 제재 메시지를 발송한다.
  - [ ] 벌점 현황이 거주자·관리자 화면에서 조회 가능하며 임계치 초과 시 제한 정책과 연동되는지 검증한다.
  - [ ] 벌점 처리 흐름에 대한 통합 테스트와 회귀 시나리오를 작성하고 상태 보드에 로그를 남긴다.
- **Feature 링크**: [Feature Inventory §3 냉장고 – 알림 & 일정](feature-inventory.md#3-냉장고--알림--일정), [Feature Inventory §4 냉장고 – 층별장(검사자)](feature-inventory.md#4-냉장고--층별장검사자)
- **목표**: 검사 결과가 사용자 벌점과 제재 정책으로 이어지도록 연동한다.
- **참고**: [mvp-scenario.md §3.2](mvp-scenario.md#32-층별장-검사-세션-단독-흐름)


---

## S3 검사 결과 알림 (mvp-scenario.md §3.3)

### NO-401 검사 결과 알림 발행
- **Status ID**: NO-401
- **체크리스트**
  - [ ] `NotificationService#sendInspectionResultNotifications` 단위/통합 테스트 확보.
  - [ ] `FRIDGE_RESULT:{sessionUuid}:{userId}` dedupe 키와 TTL이 정책과 일치하는지 검증.
  - [ ] `notification_preference` OFF 사용자는 알림 대상에서 제외되는지 확인하고, 경고/폐기 통계와 함께 발송되는지 테스트.
  - [ ] 알림 페이로드에 포함된 `correlationId`·`penaltyHistoryId`·`inspectionActionItemId`가 API 스펙과 일치하는지 검증하고 OpenAPI/프런트 타입을 동기화한다.
- **Feature 링크**: [Feature Inventory §3 냉장고 – 알림 & 일정](feature-inventory.md#3-냉장고--알림--일정)
- **목표**: 검사 제출 시 필요한 사용자에게만 중복 없이 알림이 발행된다.
- **참고**: [mvp-scenario.md §3.3](mvp-scenario.md#33-검사-후-사용자-알림)

### NO-402 검사 결과 알림 UI
- **Status ID**: NO-402
- **체크리스트**
  - [ ] 거주자 알림 목록에서 `FRIDGE_RESULT` 항목을 표시하고 관련 포장 상세 링크를 연결.
  - [ ] 폐기 알림 상세에서 벌점 1점 누적 정보를 노출.
  - [ ] 알림 읽음 처리 및 탭/상단 배지 로직을 테스트(스토리북/스냅샷 혹은 E2E).
  - [ ] 알림 상세 화면이 `inspection_action_item` 스냅샷, `penalty_history` 기록, `correlationId` 기반 링크를 모두 보여 주는지 QA 체크리스트를 확정한다.
- **Feature 링크**: [Feature Inventory §3 냉장고 – 알림 & 일정](feature-inventory.md#3-냉장고--알림--일정)
- **목표**: 거주자가 알림에서 경고/폐기/벌점 정보를 확인하고 관련 포장으로 이동할 수 있다.
- **참고**: [mvp-scenario.md §3.3](mvp-scenario.md#33-검사-후-사용자-알림) 1~3단계 시나리오 최종 구현이 목표

### NO-403 알림 설정 UI
- **Status ID**: NO-403
- **체크리스트**
  - [ ] 알림 설정 화면에서 냉장고 알림 ON/OFF 토글을 현재 사용 중인 훅/컨텍스트 상태와 연동한다.
  - [x] 토글 변경 시 백엔드 `notification_preference`와 동기화되는지 검증하고, 백그라운드 알림 허용 옵션을 추가한다.
  - [ ] 알림 설정 저장용 백엔드 API를 구현해 종류별 ON/OFF, 백그라운드 허용 여부를 업데이트하고 단위·통합 테스트로 검증한다.
  - [ ] 설정 화면에서 최근 발송 알림의 `correlationId`·상세 링크가 올바르게 작동하는지 수동/E2E 테스트 절차를 마련한다.
- **Feature 링크**: [Feature Inventory §3 냉장고 – 알림 & 일정](feature-inventory.md#3-냉장고--알림--일정)
- **목표**: 사용자가 알림 수신 여부를 직접 제어할 수 있다.
- **참고**: [mvp-scenario.md §3.3](mvp-scenario.md#33-검사-후-사용자-알림) 4단계 시나리오 최종 구현이 목표

### NO-404 알림 목록·설정 완성
- **Status ID**: NO-404
- **체크리스트**
  - [ ] 거주자 알림 목록 화면을 구현해 검사 결과·임박/만료 알림을 조회/읽음 처리하고, 하단 배지 규칙을 반영.
  - [ ] 알림 설정 화면에서 사용자별 종류별 토글, 백그라운드 수신 설정을 제공하고 API와 동기화한다.
  - [ ] 알림 UI 흐름에 대한 Playwright/E2E 테스트 또는 스냅샷을 작성해 회귀를 방지한다.
  - [ ] 상단/탭 배지 규칙, 읽음 처리, dedupe 정책이 문서와 일치하는지 QA 체크리스트를 작성한다.
- **Feature 링크**: [Feature Inventory §3 냉장고 – 알림 & 일정](feature-inventory.md#3-냉장고--알림--일정)
- **목표**: 알림 목록과 설정 UI가 사용자 입장에서 완결된 형태로 제공된다.
- **참고**: [mvp-scenario.md §3.3](mvp-scenario.md#33-검사-후-사용자-알림), [mvp-scenario.md §3.4](mvp-scenario.md#34-임박만료-자동-알림)

### NO-405 알림 실패 로그·정책 관리
- **Status ID**: NO-405
- **체크리스트**
  - [ ] 알림 발송 실패 시 `notification_dispatch_log`에 원인과 상태가 기록되도록 서비스/리포지토리를 구현하고, 재시도 정책을 명시한다.
  - [ ] 알림 재시도/무시 정책을 운영 문서([docs/ops/status-board.md](ops/status-board.md))와 코드로 정리하고, 관리자 UI에서 실패 로그를 조회 가능하게 한다.
  - [ ] 하루 발송 상한·TTL 등 `notification_policy` 설정을 API/관리자 화면에서 조정 가능하도록 구현하고 테스트를 추가한다.
  - [ ] 실패 로그 화면에서 `slotId`·`correlationId`·시간 범위 필터로 특정 검사 알림을 추적할 수 있도록 하고, 동작 여부를 통합 테스트/QA 체크리스트에 포함한다.
- **Feature 링크**: [Feature Inventory §3 냉장고 – 알림 & 일정](feature-inventory.md#3-냉장고--알림--일정), [Feature Inventory §5 냉장고 – 관리자](feature-inventory.md#5-냉장고--관리자)
- **목표**: 알림 실패가 추적되고 정책 값이 운영 UI에서 관리 가능하다.
- **참고**: [mvp-scenario.md §3.3](mvp-scenario.md#33-검사-후-사용자-알림)

---

## S4 임박·만료 자동 알림 (mvp-scenario.md §3.4)

### NO-501 배치 알림 생성
- **Status ID**: NO-501
- **체크리스트**
  - [x] Spring Scheduling cron(09:00) 설정 확인 및 개발용 수동 트리거 Bean 작성.
  - [x] `FRIDGE_EXPIRY`·`FRIDGE_EXPIRED` dedupe 키와 TTL(24h) 적용 검증, 중복 방지 로직을 단위 테스트로 보호.
  - [ ] 배치 재시도/오류 코드 정책을 정리하고 [`docs/ops/batch-notifications.md`](ops/batch-notifications.md)와 코드에 반영한다.
  - [ ] 스케줄러 통합 테스트(가짜 Clock/TaskScheduler) 작성하고, 배치 실패 시 `notification_dispatch_log`에 기록되는지 확인.
  - [ ] 임박/만료 배치 알림 생성 로직을 구현해 거주자에게 실제 발송하고, dedupe·TTL 정책이 문서와 일치하는지 점검한다.
- **Feature 링크**: [Feature Inventory §3 냉장고 – 알림 & 일정](feature-inventory.md#3-냉장고--알림--일정)
- **목표**: 임박/만료 배치가 중복 없이 생성되고 테스트로 보호된다.
- **참고**: [mvp-scenario.md §3.4](mvp-scenario.md#34-임박만료-자동-알림)

### NO-502 임박/만료 알림 UI
- **Status ID**: NO-502
- **체크리스트**
  - [ ] 알림 목록에서 임박·만료 유형에 맞는 강조 스타일을 적용.
  - [ ] 하단 탭 배지 규칙(임박: 읽으면 소거, 만료: 해결 전 유지)을 구현하고 QA 체크리스트로 검증.
  - [ ] 배치 알림 Mock 데이터 기반 UI 회귀 테스트 또는 수동 검증을 수행한다.
- **Feature 링크**: [Feature Inventory §3 냉장고 – 알림 & 일정](feature-inventory.md#3-냉장고--알림--일정)
- **목표**: 임박/만료 알림과 배지가 정책대로 동작한다.
- **참고**: [mvp-scenario.md §3.4](mvp-scenario.md#34-임박만료-자동-알림) 1~3단계

### SC-401 검사 일정·이력 서버 관리
- **Status ID**: SC-401
- **체크리스트**
  - [x] 검사 일정/이력 저장을 위한 테이블과 CRUD API를 작성해 로컬 스토리지 의존성을 제거한다(`frontend/app/_components/home/use-home-state.ts` 개선 포함).
  - [ ] 거주자/관리자 UI에서 일정·이력을 API 기반으로 조회하고, 작성/완료 이벤트를 기록한다.
  - [ ] 데이터 마이그레이션/백업 전략과 회귀 테스트(통합 또는 Playwright)를 마련한다.
- **범위 메모**: MVP에서는 **층별장**이 자신의 책임 구역(배정 칸) 기준으로 검사 일정을 생성·수정·완료 처리한다. 관리자 화면은 조회 전용으로 유지하며, Post-MVP에서 “관리자가 일정 등록/수정 → 해당 층별장에게 알림 발송” 흐름을 확장 도입한다.
- **Feature 링크**: [Feature Inventory §3 냉장고 – 알림 & 일정](feature-inventory.md#3-냉장고--알림--일정)
- **목표**: 검사 일정과 이력이 서버에서 단일 소스로 관리되고 모든 사용자에게 일관되게 노출된다.
- **참고**: [mvp-scenario.md §3.4](mvp-scenario.md#34-임박만료-자동-알림)

---

## S5 관리자 운영 통제 (mvp-scenario.md §3.5)

- **IA 합의 메모 (2025-11-01)**: 관리자 화면은 거주자·층별장과 동일한 하단 탭 구성을 유지하되, 운영 플로우(세탁/냉장고/도서관/다목적실)와 중앙 관리 플로우를 분리한다. 모듈 탭에는 현황 위젯과 “관리로 이동” 딥링크만 남기고, 자원/권한/알림/벌점/보고 등 횡단 기능은 `관리(⚙️)` 허브에서만 편집한다. 이를 통해 냉장고 증설·라벨 범위 조정, 층별장 승격/복귀, 09:00 임박 알림 정책, 누적 10점 제재 같은 공통 로직을 SSOT로 유지하며 `docs/feature-inventory.md §5`, `docs/mvp-scenario.md §3.5` 요구사항과 일치시킨다.

### AD-601 칸 설정·통계
- **Status ID**: AD-601
- **체크리스트**
  - [x] `PATCH /admin/fridge/compartments/{id}`로 `max_bundle_count` 조정 기능 검증.
  - [x] 칸 상태 `SUSPENDED` 전환 시 거주자 접근 제한 및 메시지 반환 확인.
  - [ ] 관리자 대시보드에서 층별 통계가 노출되도록 프런트 UI를 보강.
  - [ ] 냉장고 증설/재배분 시 `compartment_room_access`가 자동 재계산되고 UI에서 재배분 결과를 확인할 수 있도록 백엔드/프런트 검증 루틴을 마련한다. *(프런트 연동 TODO)*
  - [x] 냉장고 증설/재배분용 관리자 API와 서비스 로직을 구현해 정책대로 `compartment_room_access`를 갱신하고, 회귀 테스트 및 운영 절차 문서를 추가한다.
  - [ ] 관리자 검사·포장 목록 API가 `slotId`·`status`·`limit`·`page` 필터를 지원하고, 대시보드에서 해당 필터를 적용해 사례를 조회하는 절차를 QA 체크리스트로 정리한다.
- **Feature 링크**: [Feature Inventory §5 냉장고 – 관리자](feature-inventory.md#5-냉장고--관리자), [Feature Inventory §2 냉장고 – 일반 기숙사생 · 증설 정책](feature-inventory.md#냉장고-증설재배분)
- **목표**: 관리자가 칸 용량·상태를 조정하고 통계를 확인할 수 있다.
- **참고**: [mvp-scenario.md §3.5](mvp-scenario.md#35-관리자-운영-통제)

### AD-602 역할 관리
- **Status ID**: AD-602
- **체크리스트**
  - [ ] 층별장 역할 부여/해제 API와 진행 중 세션 예외 처리 로직 검증.
  - [ ] 역할 관리 화면에서 임명/해제 플로우와 알림 안내를 구현하고 “준비 중” 구역을 제거한다.
  - [ ] Playwright/수동 시나리오로 역할 변경이 UI·권한에 즉시 반영되는지, 진행 중 검사 종료가 안전하게 처리되는지 확인한다.
- **Feature 링크**: [Feature Inventory §5 냉장고 – 관리자](feature-inventory.md#5-냉장고--관리자)
- **목표**: 관리자/층별장 권한 변경을 UI에서 수행하고 검증할 수 있다.
- **참고**: [mvp-scenario.md §3.5](mvp-scenario.md#35-관리자-운영-통제) 2~3단계

### AD-603 운영 도구 확장
- **Status ID**: AD-603
- **체크리스트**
  - [ ] 관리자 대시보드 “준비 중” 구역을 정비해 층별장 임명/해제, 벌점 조회, 알림 정책 관리 등 핵심 패널을 실데이터와 연결한다.
  - [ ] 포장/검사/벌점 데이터를 API 기반으로 조회·필터링하고, CSV/로그 다운로드 등 운영 편의 기능을 제공한다.
  - [ ] 관리자 도구 UX 흐름을 Playwright 또는 수동 시나리오로 검증하고 상태 보드에 기록한다.
  - [ ] 검사 이력 테이블에서 `slotId`·`status`·기간·`limit` 필터를 조합해 데모 요구사항을 재현하고, 관련 API 파라미터·응답 예시를 문서화한다.
- **Feature 링크**: [Feature Inventory §5 냉장고 – 관리자](feature-inventory.md#5-냉장고--관리자)
- **목표**: 운영자가 GUI만으로 핵심 정책·데이터를 점검하고 조정할 수 있다.
- **참고**: [mvp-scenario.md §3.5](mvp-scenario.md#35-관리자-운영-통제)

### AD-604 벌점·제한 정책 연동
- **Status ID**: AD-604
- **체크리스트**
  - [ ] 벌점 누적/해제 현황을 관리자 화면과 거주자 알림에 연결하고, 임계치 초과 시 이용 제한 정책과 동기화한다.
  - [ ] 벌점 해제·이의신청 등 후속 처리 플로우와 감사 로그를 정의하고 테스트한다.
  - [ ] 벌점/제한 관련 운영 문서와 회귀 테스트 케이스를 정리한다.
- **Feature 링크**: [Feature Inventory §3 냉장고 – 알림 & 일정](feature-inventory.md#3-냉장고--알림--일정), [Feature Inventory §5 냉장고 – 관리자](feature-inventory.md#5-냉장고--관리자)
- **목표**: 벌점과 제재 정책이 운영 도구와 사용자 경험에 일관되게 반영된다.
- **참고**: [mvp-scenario.md §3.5](mvp-scenario.md#35-관리자-운영-통제)

---

## SX 회귀 & 산출물 (mvp-scenario.md §4)

### RG-701 회귀 테스트
- **Status ID**: RG-701
- **체크리스트**
  - [ ] `./gradlew test`, `/actuator/health`, `/fridge/slots`, `/fridge/inspections/active` 스모크 호출.
  - [ ] 거주자→층별장→관리자 e2e 또는 수동 시나리오 실행 후 결과를 [docs/ops/status-board.md](ops/status-board.md)에 기록.
  - [ ] 프런트 환경에서 새 API/필드(`freshness`, `maxBundleCount` 등) 사용 여부 점검 및 Mock/스토리북 정리.
  - [ ] 검사 결과 알림(`correlationId`, `inspection_action_item`)·페이지네이션·필터 조합 사례가 회귀 테스트에 포함됐음을 보고서에 요약한다.
- **목표**: 전체 데모 흐름이 회귀 테스트로 확인되고 핵심 API가 정상임을 증명한다.
- **참고**: [mvp-scenario.md §4](mvp-scenario.md#4-마무리-및-배포-안정성-강조)

### RG-702 산출물 정리
- **Status ID**: RG-702
- **체크리스트**
  - [ ] 테스트 로그·스크린샷을 수집하고 PASS/FAIL을 status-board에 명시.
  - [ ] 확장 대비 코드 주석/현황을 README/Docs에 기록, 잔여 이슈는 트래커(GitHub/노션)로 이관.
  - [ ] Flyway `V11__drop_notification_policy_table.sql` 적용 여부 확인, 필요 시 `flywayRepair`.
  - [ ] RG-701~704 실행 내역(스모크, 알림/검사 회귀, 프런트 E2E)을 마무리 보고서와 데모 슬라이드에 한 줄 요약으로 남긴다.
- **목표**: 데모 보고와 배포 안정성 근거가 정리되어 후속 일정에 활용 가능하다.
- **참고**: [mvp-scenario.md §4](mvp-scenario.md#4-마무리-및-배포-안정성-강조)

### RG-703 검사·알림 회귀 테스트 보강
- **Status ID**: RG-703
- **체크리스트**
  - [ ] 검사 시작/조치/제출, 벌점 연동, 거주자 열람 흐름을 통합 테스트와 Playwright 시나리오로 커버.
  - [ ] 알림 발행·읽음·설정·정책 변경 플로우에 대한 백엔드·프런트 회귀 테스트를 추가한다.
  - [ ] CI에서 검사/알림 테스트가 기본 스위트로 실행되도록 구성한다.
- **목표**: 검사와 알림 핵심 플로우가 자동화 테스트로 보호된다.
- **참고**: [mvp-scenario.md §3.2](mvp-scenario.md#32-층별장-검사-세션-단독-흐름), [mvp-scenario.md §3.3](mvp-scenario.md#33-검사-후-사용자-알림)

### RG-704 프런트 E2E/Escape 테스트
- **Status ID**: RG-704
- **체크리스트**
  - [ ] 거주자 포장 CRUD, 검사 열람, 알림 확인·설정 등 주요 UX를 Playwright로 스크립트화한다.
  - [ ] 비정상 케이스(권한 부족, 용량 초과, 알림 실패)를 포함한 E2E 테스트와 스냅샷을 준비한다.
  - [ ] 테스트 결과를 status-board에 기록하고 회귀 실패 시 대응 전략을 문서화한다.
- **목표**: 프런트 핵심 시나리오가 자동화 테스트로 검증되어 회귀 위험을 줄인다.
- **참고**: [docs/ai-impl/frontend.md](ai-impl/frontend.md), [docs/ops/status-board.md](ops/status-board.md).

---

## 시나리오 검증 가이드 (mvp-scenario.md 요약)
- **S0 공통 준비 (§2)**: EN-101, EN-102, AU-101~103
- **S1 거주자 포장 관리 (§3.1)**: FR-201~FR-205
- **S2 층별장 검사 세션 (§3.2)**: IN-301~IN-305 *(Stretch: IN-306)*
- **S3 검사 결과 알림 (§3.3)**: NO-401~NO-405
- **S4 임박/만료 알림 & 일정 (§3.4)**: NO-501, NO-502, SC-401
- **S5 관리자 운영 통제 (§3.5)**: AD-601~AD-604
- **SX 회귀 & 산출물 (§4)**: RG-701~RG-704

> 위 시나리오는 각 기능(Status ID)이 구현된 후 데모/QA에서 어떻게 검증되는지를 요약한 것으로, 세부 단계는 `docs/mvp-scenario.md`를 참고한다.

---

## Post-MVP 참고 메모
- **인증**
  - 비밀번호 변경·탈퇴 시 `user_session` 전체를 즉시 폐기하고 감사 로그를 남기는 흐름은 AU-101~103 확장 시 필수다(연계 체크리스트 참고).
  - 로그인/리프레시 API는 `device_id`·만료 세션 정리 로직을 갖추었으므로 후속 기능에서 재사용한다.


### IN-306 실시간 검사 합류·복구 *(Stretch)*
- **Status ID**: IN-306
- **상태**: Post-MVP 확장 과제
- **체크리스트**
  - [ ] SSE 기반 `inspection-session` 스트림을 구현·검증해 두 번째 검사자가 합류 시 기존 세션에 동기화되도록 한다.
  - [ ] 조치 이벤트에 검사자 식별자와 타임스탬프를 포함해 다중 검사 시 중복 조치를 방지하고, 프런트 UI에서 실시간으로 반영되는지 확인한다.
  - [ ] EventSource 재연결/타임아웃 처리와 단독 모드 전환 시나리오를 통합 테스트 또는 Playwright 시나리오로 검증하고, 장애 발생 시 복구 지침을 [docs/ops/status-board.md](ops/status-board.md)에 기록한다.
- **Feature 링크**: [Feature Inventory §4 냉장고 – 층별장(검사자) · 실시간 협업](feature-inventory.md#실시간-협업-및-복구)
- **목표**: 다중 검사자가 하나의 세션에서 실시간으로 협업하고, 네트워크 장애 시 안전하게 복구한다. *(MVP 직후 최우선 확장 항목으로 계획한다.)*
- **참고**: [mvp-scenario.md §3.2](mvp-scenario.md#32-층별장-검사-세션-단독-흐름)
