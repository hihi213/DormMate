# DormMate 냉장고 MVP 구현 계획
*용도: `docs/mvp-scenario.md`의 범위를 실행 가능한 작업 단위로 나눈 체크리스트로, 착수 시 우선순위와 완료 조건을 확인한다.*

> 목적: `docs/mvp-scenario.md`에 정의된 시연 흐름을 기준으로, 이미 존재하는 확장 대비 코드의 의도를 유지하면서 MVP 기능을 순차적으로 구현·검증하기 위한 실행 계획을 문서화한다.

## 사용 가이드
- 위 체크리스트를 순차적으로 진행하면서, 각 항목 완료 시 표시한다.
- 특정 항목을 착수할 때는 `docs/ops/status-board.md`에 세부 작업·테스트 명령·결과를 기록하고, 세부 작업이 모두 끝난 뒤에만 해당 체크박스를 `[x]`로 전환한다.
- 작업 중 UI 변경이 필요하다고 판단되면, UI 변경을 즉시 적용하지 말고 다른 작업을 마무리한 후 별도의 변경 제안을 사용자에게 제출한다.
- 확장 대비 코드(예: 다중 검사자, 알림 정책 UI 용 필드)는 삭제하지 않고, 주석/문서화로 현재는 비활성 기능임을 명확히 한다.
- 새 기능을 추가할 때는 `docs/mvp-scenario.md`, `docs/mvp-implementation-plan.md`를 우선 기준으로 삼고, 정책이 비어 있는 경우에만 `docs/feature-inventory.md`와 `docs/data-model.md`를 교차 확인해 문서를 업데이트한다.


## 1. 거주자 포장 등록 및 관리
### 백엔드 작업
- [ ] `GET /fridge/slots`: 배정 칸만 노출되는지 확인 (`FridgeService#getSlots`).  
- [ ] `POST /fridge/bundles`: 허용량(`max_bundle_count`) 초과 시 422 처리 ("CAPACITY_EXCEEDED").  
- [ ] `PATCH/DELETE /fridge/items/{id}`: 소프트 삭제 후 라벨 재사용 여부 (`bundle_label_sequence`) 검증.
- [ ] demo 계정·칸 매핑(`V6__seed_fridge_sample_data.sql`)과 라벨 시퀀스 초기화 상태 점검.
### 프론트 작업
- [ ] `내 냉장고` 화면에서 배정 칸만 선택 가능하도록 API 파라미터 조정 (`/fridge/slots`).  
- [ ] 포장 등록 폼: 수량·유통기한 검증 메시지 및 등록 후 목록/검색 갱신.  
- [ ] 임박/만료 배지 색상 로직을 `freshness` 필드(`ok/expiring/expired`) 기반으로 통합.  
- [x] 칸 상태 비활성화(HTTP 423, `COMPARTMENT_SUSPENDED`) 응답 시 접근 차단 메시지 노출.

## 2. 층별장 검사 세션 (단독 흐름)
### 백엔드 작업
- [ ] `POST /fridge/inspections`: 층별장/관리자만 접근 가능(`InspectionService#startSession`).  
- [ ] 세션 시작 시 칸 잠금(`FridgeCompartment.locked`, `lockedUntil`) 적용 확인.  
- [ ] `POST /fridge/inspections/{id}/actions`: PASS/WARN/DISPOSE/UNREGISTERED_DISPOSE 저장 및 미등록 품목 이벤트 생성.  
- [ ] `POST /fridge/inspections/{id}/submit`: 통계 집계, 잠금 해제, `InspectionSession` 상태 전환 검증.
### 프론트 작업
- [ ] 검사 관리 페이지에서 잠금 상태 UI(‘검사 중’)와 버튼 비활성화 처리.  
- [ ] 조치 선택 UI에서 액션 코드 매핑 유지, 미등록 물품 입력 폼 지원.  
- [ ] 제출 시 요약 모달/토스트로 경고/폐기/총 포장 수 표시.

## 3. 검사 후 알림
### 백엔드 작업
- [ ] `NotificationService#sendInspectionResultNotifications` 단위 테스트 또는 통합 검증.  
- [ ] dedupe 키(`FRIDGE_RESULT:{sessionUuid}:{userId}`) 중복 차단 확인.  
- [ ] `notification_preference` 기본값 ON 상태 확인 및 비활성 사용자의 제외 로직 검증.
### 프론트 작업
- [ ] 거주자 알림 목록에서 검사 결과 유형(`FRIDGE_RESULT`) 표시 및 관련 포장 상세 링크 연결.  
- [ ] 알림 읽음 처리 및 배지 감소 로직 테스트.  
- [ ] 알림 설정 화면에서 냉장고 알림 토글과 로컬 스토리지/Redux 상태 연동.

## 4. 임박/만료 자동 알림
### 백엔드 작업
- [ ] Spring Scheduling cron(09:00) 설정 확인, 로컬에서는 수동 트리거 가능하도록 개발용 Bean 준비.  
- [ ] `FRIDGE_EXPIRY`/`FRIDGE_EXPIRED` dedupe 키 및 TTL(24h) 적용 검증.  
- [ ] 만료 알림이 해소 전까지 유지되도록 `NotificationState`와 `expiredAt` 처리 확인.
### 프론트 작업
- [ ] 알림 목록에서 임박/만료 유형에 맞는 강조 스타일 적용.  
- [ ] 하단 탭 배지 규칙(임박: 읽으면 소거, 만료: 해결 전 유지) 구현.  
- [ ] 배치 알림 Mock 데이터를 사용한 UI 회귀 테스트.

## 5. 관리자 운영 통제
### 백엔드 작업
- [x] `PATCH /admin/fridge/compartments/{id}`(또는 대응 API)로 `max_bundle_count` 조정 기능 검증.  
- [ ] 층별장 역할 부여/해제 API와 진행 중 세션 처리 예외 확인.  
- [x] 칸 상태 `SUSPENDED` 전환 시 거주자 접근 제한 및 메시지 반환 확인.
### 프론트 작업
- [ ] 관리자 대시보드에서 층별 통계 표시(현재 API 응답 필드 재활용).  
- [x] 칸 설정 변경 UI에서 용량 조정 및 상태 전환 폼 제공, `PATCH /admin/fridge/compartments/{id}` 호출 후 사용자 화면 반영 확인.  
- [ ] 역할 관리 화면에서 임명/해제 플로우와 알림 안내 추가.

## 6. 공통 검증 & 회귀
### 백엔드 작업
- [ ] `./gradlew test` 회귀 실행.  
- [ ] Flyway `V11__drop_notification_policy_table.sql`이 모든 환경에 적용됐는지 확인, 필요 시 `flywayRepair`.  
- [ ] `/actuator/health`, `/fridge/slots`, `/fridge/inspections/active` 등 핵심 API 스모크 호출.
### 프론트 작업
- [ ] 거주자 → 층별장 → 관리자 시나리오를 묶은 e2e 테스트(or 수동 스크립트) 실행.  
- [ ] 프론트 env에서 새 API/필드(`freshness`, `maxBundleCount` 등) 사용 여부 점검.  
- [ ] 데모용 Seed 데이터와 동기화된 Mock/스토리북 상태 관리.

## 7. 산출물 & 보고
- [ ] 테스트 로그, 스크린샷(필요시) 수집.  
- [ ] 확장 대비 코드(주석, TODO 등) 유지 현황을 README/Docs에 간단히 기록.  
- [ ] 발견된 이슈는 GitHub Issue 또는 노션 등 프로젝트 트래커에 등록.

---
