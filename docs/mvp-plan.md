# DormMate 냉장고 MVP 구현 계획
*용도: `docs/mvp-scenario.md` 범위를 시나리오 단위 작업 블록으로 정리한 체크리스트다. 각 블록은 `docs/ops/status-board.md`에서 WIP/DONE을 추적할 수 있는 Status ID와 연결된다.*

> 목적: 시연 플로우를 안정적으로 구현하면서도 확장 대비 코드를 보존하기 위해, 백엔드·프런트·테스트 관점의 핵심 작업을 시나리오 흐름 순서대로 정의한다.

## 사용 가이드
- 진행·기록 상세 절차는 `docs/ops/status-board.md`를 따른다.
- 참고의 `docs/mvp-scenario.md`에서 실제 구현해야할 시나리오 단계(S0~S5, SX)를 확인하고 아래 Status ID를 사용자에게 재진술해 합의한다.
- 각 Status 착수 전 `docs/mvp-scenario.md` 해당 절과 `docs/feature-inventory.md` 연결 섹션(본문 *관련 문서* 링크)을 모두 읽고, 이해한 근거를 `docs/ops/status-board.md`에 명시한다.
- **착수 전 공통 스캔 루틴** – 어떤 Status든 시작하기 전에 아래 자료를 순서대로 훑어보고 핵심 포인트를 메모한다.
  1. `docs/mvp-scenario.md`에서 해당 시나리오 구간을 확인해 전체 흐름과 데모 요구사항을 정리한다.
  2. `docs/feature-inventory.md`에서 모듈별 정책·예외·상태 정의를 찾아 코드/테스트에 반영할 체크리스트를 만든다.
  3. `docs/data-model.md`에서 연관 테이블·필드·상태값을 리뷰하고, 관련 마이그레이션/도메인 엔티티 파일 위치를 메모한다.
  4. 필요 시 `docs/ai-impl/backend.md`, `docs/ai-impl/frontend.md`의 구현 지침과 기존 `docs/ops/status-board.md` 로그를 참고해 이전 결정 사항을 상기한다.
  5. 상기 내용을 `docs/ops/status-board.md` WIP 섹션에 근거로 기록한 뒤 구현에 착수한다.
- UI 변경 필요성이 보이면 우선 다른 작업을 마무리한 뒤 사용자에게 변경 제안을 제출한다. (지침: `docs/ai-impl/frontend.md`)
- 확장 대비 코드(다중 검사자, 알림 정책 UI 등)는 삭제하지 말고, 필요 시 주석과 문서로 현재 비활성 상태임을 명시한다. (지침: `docs/ai-impl/backend.md`, `docs/ai-impl/frontend.md`)
- 정책·데이터 모델이 불명확할 때는 `docs/feature-inventory.md`, `docs/data-model.md`를 교차 참고해 문서를 업데이트한다.

## S0 공통 준비 (mvp-scenario.md §2)

### EN-101 환경 베이스라인
- **Status ID**: EN-101
- **체크리스트**
  - [x] Gradle 모듈·패키지 스켈레톤 정리 및 핵심 의존성 버전 고정(`build.gradle`, plugins/dependencyManagement 버전 확인).
  - [x] `./auto tests backend`, `./auto dev warmup` 명령 경로 확인 및 통합 테스트 기본 픽스처 구성.
- **목표**: 모든 작업자가 동일한 빌드/테스트 명령으로 환경을 재현할 수 있다.
- **참고**: `docs/ai-impl/backend.md`, `docs/ai-impl/frontend.md`.

### EN-102 데이터 베이스라인
- **Status ID**: EN-102
- **체크리스트**
  - [x] Flyway 베이스라인과 데모 시드(`V6__seed_fridge_sample_data.sql`) 자동화를 검증하고 롤백 절차를 문서화.
  - [x] 데모 환경 `.env`·Docker Compose 구성 정리 및 비상 전환 플랜(mvp-scenario.md §4) 기록.
- **목표**: 데모/로컬 환경에서 동일한 데이터로 기동·롤백을 수행할 수 있다.
- **참고**: `docs/mvp-scenario.md` §2, `docs/feature-inventory.md` §2.

---

## S1 거주자 포장 관리 (mvp-scenario.md §3.1)

### FR-201 슬롯 접근 제어
- **Status ID**: FR-201
- **체크리스트**
  - [x] `GET /fridge/slots`가 배정 칸만 반환하는지 검증(`FridgeService#getSlots`).
  - [x] 프런트 슬롯 선택 UX가 배정 칸만 표시하도록 API 파라미터/필터를 적용.
  - [x] 데모 계정·칸 매핑과 라벨 시퀀스 초기화 상태 점검.
- **목표**: 거주자가 자신의 칸만 선택해 등록을 시작할 수 있다.
- **참고**: `docs/data-model.md` §4.1, `docs/feature-inventory.md` §2.

### FR-202 포장 등록 플로우
- **Status ID**: FR-202
- **체크리스트**
  - [ ] `POST /fridge/bundles`에서 `max_bundle_count` 초과 시 422(`CAPACITY_EXCEEDED`)가 반환되는지 확인.
  - [ ] 포장 등록 폼의 수량·유통기한 검증과 등록 후 목록/검색 즉시 갱신을 구현.
  - [x] 칸 상태 비활성화(HTTP 423 `COMPARTMENT_SUSPENDED`) 응답 시 접근 차단 메시지를 노출.
- **목표**: 거주자가 제한된 용량 안에서 포장을 생성하고 즉시 결과를 확인한다.
- **참고**: `docs/mvp-scenario.md` §3.1 1~4단계 시나리오 최종 구현이 목표

### FR-203 임박/만료 · 라벨 재사용
- **Status ID**: FR-203
- **체크리스트**
  - [ ] `PATCH/DELETE /fridge/items/{id}` 소프트 삭제 후 라벨 재사용(`bundle_label_sequence`)을 검증.
  - [ ] 임박/만료 배지를 `freshness`(`ok/expiring/expired`) 기반으로 통합 표시.
  - [ ] `FridgeIntegrationTest` 및 `npm test -- fridge-badge`로 임박/만료·라벨 플로우 회귀 테스트.
- **목표**: 임박/만료 상태가 즉시 반영되고 삭제 후 라벨을 재사용할 수 있다.
- **참고**: `docs/mvp-scenario.md` §3.1 5~6단계 시나리오 최종 구현이 목표

---

## S2 층별장 검사 세션 (mvp-scenario.md §3.2)

### IN-301 검사 시작·잠금
- **Status ID**: IN-301
- **체크리스트**
  - [ ] `POST /fridge/inspections` 접근 권한(층별장/관리자) 검증 및 세션 생성.
  - [ ] 세션 시작 시 칸 잠금(`FridgeCompartment.locked`, `lockedUntil`) 적용을 검증.
  - [ ] 프런트 검사 관리 페이지에서 잠금 상태 표시와 거주자 화면 버튼 비활성화를 구현.
- **목표**: 검사 시작 시 칸이 잠기고 다른 사용자에게도 잠금 상태가 반영된다.
- **참고**: `docs/feature-inventory.md` §6, `docs/mvp-scenario.md` §3.2 1~2단계 시나리오 최종 구현이 목표

### IN-302 조치 선택·벌점 연동
- **Status ID**: IN-302
- **체크리스트**
  - [ ] `POST /fridge/inspections/{id}/actions`로 PASS/WARN/DISPOSE/UNREGISTERED_DISPOSE 조치를 저장.
  - [ ] DISPOSE 조치 시 Penalty 도메인으로 벌점 1점 누적 이벤트가 발행되는지 검증.
  - [ ] 프런트 조치 UI에서 액션 코드 매핑과 미등록 물품 입력 플로우를 구현.
- **목표**: 층별장이 조치별로 기록을 남기고 폐기 시 벌점이 즉시 반영된다.
- **참고**: `docs/mvp-scenario.md` §3.2 3~4단계 시나리오 최종 구현이 목표, `docs/data-model.md` §4.3 

### IN-303 제출 요약·잠금 해제
- **Status ID**: IN-303
- **체크리스트**
  - [ ] `POST /fridge/inspections/{id}/submit`에서 통계 집계와 잠금 해제를 검증.
  - [ ] 제출 시 경고/폐기/총 포장 수 요약을 모달 또는 토스트로 표시.
  - [ ] Playwright/수동 테스트로 제출 후 잠금 해제와 거주자 UI 복구를 확인.
- **목표**: 검사 완료 시 결과 요약을 보여주고 칸이 다시 편집 가능해진다.
- **참고**: `docs/mvp-scenario.md` §3.2 5~6단계 시나리오 최종 구현이 목표

---

## S3 검사 결과 알림 (mvp-scenario.md §3.3)

### NO-401 검사 결과 알림 발행
- **Status ID**: NO-401
- **체크리스트**
  - [ ] `NotificationService#sendInspectionResultNotifications` 단위/통합 테스트 확보.
  - [ ] `FRIDGE_RESULT:{sessionUuid}:{userId}` dedupe 키로 중복 차단을 검증.
  - [ ] `notification_preference` OFF 사용자는 알림 대상에서 제외되는지 확인.
- **목표**: 검사 제출 시 필요한 사용자에게만 중복 없이 알림이 발행된다.
- **참고**: `docs/feature-inventory.md` §3.1.

### NO-402 검사 결과 알림 UI
- **Status ID**: NO-402
- **체크리스트**
  - [ ] 거주자 알림 목록에서 `FRIDGE_RESULT` 항목을 표시하고 관련 포장 상세 링크를 연결.
  - [ ] 폐기 알림 상세에서 벌점 1점 누적 정보를 노출.
  - [ ] 알림 읽음 처리 및 배지 감소 로직을 테스트(스토리북/스냅샷 혹은 E2E).
- **목표**: 거주자가 알림에서 경고/폐기/벌점 정보를 확인하고 관련 포장으로 이동할 수 있다.
- **참고**: `docs/mvp-scenario.md` §3.3 1~3단계 시나리오 최종 구현이 목표

### NO-403 알림 설정 UI
- **Status ID**: NO-403
- **체크리스트**
  - [ ] 알림 설정 화면에서 냉장고 알림 ON/OFF 토글과 클라이언트 상태(Zustand/Redux 등) 연동.
  - [ ] 토글 변경 시 백엔드 `notification_preference`와 동기화되는지 검증.
- **목표**: 사용자가 알림 수신 여부를 직접 제어할 수 있다.
- **참고**: `docs/mvp-scenario.md` §3.3 4단계 시나리오 최종 구현이 목표

---

## S4 임박·만료 자동 알림 (mvp-scenario.md §3.4)

### NO-501 배치 알림 생성
- **Status ID**: NO-501
- **체크리스트**
  - [ ] Spring Scheduling cron(09:00) 설정 확인 및 개발용 수동 트리거 Bean 작성.
  - [ ] `FRIDGE_EXPIRY`·`FRIDGE_EXPIRED` dedupe 키와 TTL(24h) 적용 검증.
  - [ ] 스케줄러 통합 테스트(가짜 Clock/TaskScheduler) 작성.
- **목표**: 임박/만료 배치가 중복 없이 생성되고 테스트로 보호된다.
- **참고**: `docs/feature-inventory.md` §3.3.

### NO-502 임박/만료 알림 UI
- **Status ID**: NO-502
- **체크리스트**
  - [ ] 알림 목록에서 임박·만료 유형에 맞는 강조 스타일을 적용.
  - [ ] 하단 탭 배지 규칙(임박: 읽으면 소거, 만료: 해결 전 유지)을 구현.
  - [ ] 배치 알림 Mock 데이터 기반 UI 회귀 테스트 또는 수동 검증.
- **목표**: 임박/만료 알림과 배지가 정책대로 동작한다.
- **참고**: `docs/mvp-scenario.md` §3.4 1~3단계.

---

## S5 관리자 운영 통제 (mvp-scenario.md §3.5)

### AD-601 칸 설정·통계
- **Status ID**: AD-601
- **체크리스트**
  - [x] `PATCH /admin/fridge/compartments/{id}`로 `max_bundle_count` 조정 기능 검증.
  - [x] 칸 상태 `SUSPENDED` 전환 시 거주자 접근 제한 및 메시지 반환 확인.
  - [ ] 관리자 대시보드에서 층별 통계가 노출되도록 프런트 UI를 보강.
- **목표**: 관리자가 칸 용량·상태를 조정하고 통계를 확인할 수 있다.
- **참고**: `docs/feature-inventory.md` §5.

### AD-602 역할 관리
- **Status ID**: AD-602
- **체크리스트**
  - [ ] 층별장 역할 부여/해제 API와 진행 중 세션 예외 처리 로직 검증.
  - [ ] 역할 관리 화면에서 임명/해제 플로우와 알림 안내를 구현.
  - [ ] Playwright/수동 시나리오로 역할 변경이 UI·권한에 반영되는지 확인.
- **목표**: 관리자/층별장 권한 변경을 UI에서 수행하고 검증할 수 있다.
- **참고**: `docs/mvp-scenario.md` §3.5 2~3단계.

---

## SX 회귀 & 산출물 (mvp-scenario.md §4)

### RG-701 회귀 테스트
- **Status ID**: RG-701
- **체크리스트**
  - [ ] `./gradlew test`, `/actuator/health`, `/fridge/slots`, `/fridge/inspections/active` 스모크 호출.
  - [ ] 거주자→층별장→관리자 e2e 또는 수동 시나리오 실행 후 결과를 `docs/ops/status-board.md`에 기록.
  - [ ] 프런트 환경에서 새 API/필드(`freshness`, `maxBundleCount` 등) 사용 여부 점검 및 Mock/스토리북 정리.
- **목표**: 전체 데모 흐름이 회귀 테스트로 확인되고 핵심 API가 정상임을 증명한다.
- **참고**: `docs/mvp-scenario.md` §4.

### RG-702 산출물 정리
- **Status ID**: RG-702
- **체크리스트**
  - [ ] 테스트 로그·스크린샷을 수집하고 PASS/FAIL을 status-board에 명시.
  - [ ] 확장 대비 코드 주석/현황을 README/Docs에 기록, 잔여 이슈는 트래커(GitHub/노션)로 이관.
  - [ ] Flyway `V11__drop_notification_policy_table.sql` 적용 여부 확인, 필요 시 `flywayRepair`.
- **목표**: 데모 보고와 배포 안정성 근거가 정리되어 후속 일정에 활용 가능하다.
- **참고**: `docs/ops/status-board.md`, `docs/feature-inventory.md` §8.

---
