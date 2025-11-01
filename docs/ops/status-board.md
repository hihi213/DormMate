# 진행/상태 보드
*용도: `docs/mvp-plan.md`에서 선택한 작업의 세부 진행 상황과 테스트 결과를 기록하는 로그 보드로, 완료 후 근거를 남길 때 사용한다.*

현재 작업의 완료 여부와 다음 우선순위를 간단히 체크한다.

## 사용 지침
- 진행 절차: `docs/mvp-plan.md`에서 항목 선택 → 여기(Status Board)에 WIP로 요구사항·세부 작업·테스트 계획을 기록 → 작업/테스트 완료 후 PASS/FAIL 근거 남김 → `docs/mvp-plan.md` 체크박스를 `[x]`로 갱신.
- 수행할 작업은 `docs/mvp-plan.md`에서 선택하고, 세부 단계·테스트·결과를 이 보드에 기록한다.
- 개별 체크 항목을 모두 마무리한 뒤에만 `docs/mvp-plan.md`의 체크박스를 `[x]`로 갱신한다.
- 작업 중 UI 변경 필요성이 생기면, 변경 제안을 올리기 전까지 여기에서만 메모하고 실제 UI 수정은 사용자 승인 후 진행한다.
- 테스트 로그는 `` `명령` `` 다음 줄에 `(PASS|FAIL, YYYY-MM-DD — 요약 메모)` 형식으로 남긴다.

---

### (Backlog) IN-306 실시간 검사 합류·복구 — Stretch
- **비고**: MVP 범위 밖 확장 과제. SSE 합류·재연결 설계 노트는 [docs/mvp-plan.md](../mvp-plan.md#in-306-실시간-검사-합류복구)와 [docs/feature-inventory.md](../feature-inventory.md#실시간-협업-및-복구)에 정리되어 있으며, 차기 일정에서 착수한다.
- **선결 조건**: IN-301~IN-305 안정화 및 회귀 테스트 통과, SSE 이벤트 스키마/세션 락 설계 확정.
- **테스트 계획(예정)**: `./gradlew test --tests *InspectionSse*`, `npx playwright test --grep @inspection-sse`, 네트워크 오류 강제 재연결 수동 시나리오.

### EN-101 환경 베이스라인 — DONE (2024-11-24, Codex)
- **범위**: backend `build.gradle` 핵심 의존성·플러그인 버전 고정 검증, 공통 명령(`./auto tests backend`, `./auto dev warmup`) 실행 경로/캐시 점검, 통합 테스트 기본 픽스처 유효성 확인.
- **세부 작업**
  - 기존 build 스크립트와 최근 변경분을 비교해 버전 편차 및 누락 없음 확인(`backend/build.gradle`).
  - `auto` 스크립트가 Gradle/Node 경로를 적절히 세팅하는지 점검하고 재시도 시 오프라인/온라인 모드 전환 로그 확인.
  - 통합 테스트 픽스처 구조(`backend/src/test/java/com/dormmate/backend/...`)와 베이스 클래스(`AbstractPostgresIntegrationTest`) 유효성 확인.
- **테스트 계획**
  - `./auto tests backend`
    - (PASS, 2024-11-24 — 초기 오프라인 캐시 부재로 1회 실패 후 온라인 재시도 성공, 캐시 확보 확인)
  - `./auto dev warmup`
    - (PASS, 2024-11-24 — Gradle/Node/Playwright 캐시 준비 및 npm audit 0 vulnerabilities 확인)
- **리스크/의존성**: 현재 통합 테스트는 Testcontainers 의존성을 사용하므로 Docker 데몬 비가동 시 실패 가능. 캐시 초기화 후 오프라인 모드 정상 동작 확인.

### EN-102 데이터 베이스라인 — DONE (2024-11-24, Codex)
- **범위**: Flyway 베이스라인 및 시드 스크립트(`V6__seed_fridge_sample_data.sql`) 자동화 검증, 롤백/재적용 절차 기록, 데모 `.env`·Docker Compose 구성 점검.
- **세부 작업**
  - `V1~V11` 버전 스키마와 `R__Seed.sql` repeatable 스크립트 적용 상태 확인, 최신 마이그레이션이 성공 이력으로 남아 있음 검증(`flyway_schema_history` 기준).
  - PostgreSQL 16.4와 Flyway 9.22.3 조합에서 지원 경고 노출됨을 확인하고, 필요 시 Flyway 10.x 업그레이드 혹은 PostgreSQL 15 호환 이미지로 전환 TODO 제안.
  - `.env`, `docker-compose*.yml` 간 변수 매핑·비상 전환 플랜 점검(`mvp-scenario.md §4` 참고) — 로컬/데모 환경 전환 시 `docker compose down && docker compose up -d` 및 `flywayMigrate` 재실행 절차 정리.
- **테스트 및 확인 로그**
  - `./gradlew flywayInfo --offline`
    - (PASS, 2024-11-24 — Schema version 11, repeatable seed 성공. PostgreSQL 16.4 호환 경고 기록)
  - `./gradlew flywayMigrate -i`
    - (PASS, 2024-11-24 — 추가 마이그레이션 없음, idempotent 검증)
  - `docker compose ps`
    - (PASS, 2024-11-24 — db/redis/pgadmin 컨테이너 기동 및 healthy 상태 확인)
- **리스크/의존성**: Flyway 9.x가 PostgreSQL 15까지만 공식 지원 → 배포 환경에서 16.x 사용 시 업그레이드 계획 필요. 시드 스크립트는 UPSERT(ON CONFLICT) 기반이라 재적용 안전하나, 외부에서 수동 데이터 수정 시 label_range/next_label 값 역행 가능성 있음.

### EN-102 데이터 베이스라인 (Flyway 10.x 업그레이드) — DONE (2024-11-24, Codex)
- **범위**: Gradle Flyway 플러그인/의존성을 10.17.0으로 상향하고 PostgreSQL 전용 플러그인을 buildscript/classpath에 포함해 CLI 버전과 정렬, 마이그레이션 경고 제거.
- **세부 작업**
  - `backend/build.gradle`에서 Flyway 플러그인·core·database-postgresql 의존성 버전을 10.17.0으로 갱신하고, Flyway 태스크 classpath(`flyway` configuration 및 buildscript classpath) 재구성.
  - Flyway 10.x 모듈 구조로 인해 발생한 `No database found` 오류를 PostgreSQL 데이터베이스 플러그인 추가 및 Gradle configuration 정리로 해결.
  - Flyway 태스크에 사용할 configuration 배열을 명시(`flyway`, `runtimeClasspath`)해 실행 시 동일 classpath를 보장.
- **검증 로그**
  - `./gradlew flywayInfo`
    - (PASS, 2024-11-24 — Schema version 11, PostgreSQL 플러그인 로드 정상)
  - `./gradlew flywayMigrate -i`
    - (PASS, 2024-11-24 — 추가 마이그레이션 없음, idempotent 확인)
  - `./auto tests backend`
    - (PASS, 2024-11-24 — 초기 오프라인 시도 시 새 플러그인 미캐시로 실패 → 자동 재시도(`--refresh-dependencies`) 후 전체 테스트 통과)
- **리스크/의존성**: Flyway 플러그인 10.x가 buildscript classpath에 PostgreSQL 플러그인을 요구하므로 신규 버전 반영 시 플러그인 아티팩트 캐시 유무를 확인해야 함. CLI/Gradle 간 버전 불일치 발생 시 재현 가능..

### AUTH-201 로그인/세션 안정화 — DONE (2025-11-01, Codex)
- **범위**: 로그인 API 오류 응답 안정화, 세션 만료 자동 정리, 디바이스 식별 관리 도입.
- **세부 작업**
  - `user_session` 테이블에 `device_id` 컬럼과 활성 인덱스 추가(`V12__add_user_session_device_id.sql`), 엔터티/리포지토리 갱신.
  - `AuthService`에서 디바이스 ID 정규화·저장, 만료 세션 일괄 `EXPIRED` 처리, 기기 불일치 시 세션을 `DEVICE_MISMATCH`로 즉시 폐기하도록 개편.
  - `ResponseStatusException` 발생 시 세션 폐기가 롤백되지 않도록 트랜잭션 전략(noRollbackFor) 조정 및 신규 동작 검증용 통합 테스트 추가.
- **테스트**
  - `./gradlew test --tests com.dormmate.backend.modules.auth.AuthServiceTest`
    - (PASS, 2025-11-01 — 디바이스 저장·만료 세션 폐기·기기 불일치 차단 시나리오 검증)
- **후속 과제**: 가입/승인(AU-101~103) 구현 시 비밀번호 변경·탈퇴와 연동해 전체 세션 폐기 기능을 확장해야 한다.

### FR-201 슬롯 접근 제어 — WIP (2025-10-31, Codex)
- **근거 문서**: `mvp-scenario.md §3.1`, `feature-inventory.md §2`, `mvp-plan.md:FR-201`
- **현행 파악**:
  - `FridgeService#getSlots`는 로그인 사용자의 `room_assignment`와 역할을 기준으로 칸을 필터링하며, 거주자·층별장·관리자 케이스가 `FridgeIntegrationTest`에 이미 포함돼 있다.
  - 프런트 `SlotSelector`는 `isSelectable`/`getDisabledDescription`을 지원하지만 동일 스코프에서 `selectedSlot`을 중복 선언해 TS 컴파일 경고 위험이 있고, 선택된 칸이 비활성/잠금일 때 트리거 버튼이 접근성 메타데이터를 제공하지 않는다.
  - 시드 스크립트(`V6__seed_fridge_sample_data.sql`)는 데모 계정 ↔ 칸 매핑과 라벨 시퀀스를 유지하고 있어 추가 데이터 보정은 필요하지 않다.
- **세부 작업**
  1. `./gradlew test --tests com.dormmate.backend.modules.fridge.FridgeIntegrationTest` 재실행으로 서버 슬롯 필터 회귀를 확인한다.
  2. `SlotSelector`에서 선택 슬롯 메모이제이션을 재사용하도록 정리하고 `aria-disabled`를 추가해 잠금/비활성 칸이 접근성 측면에서도 명확히 표시되도록 개선한다.
  3. `AddItemDialog`와 슬롯 필터 UI가 갱신된 `SlotSelector` 시그니처를 그대로 활용하는지 수동 점검하고, 필요 시 가드 로직을 보완한다.
 4. 시드 데이터 및 `bundle_label_sequence` 상태를 샘플 조회해 데모 기준 칸/배정 데이터가 의도대로인지 스팟 체크한다.
- 2025-11-02: 관리자 전용 전시 물품 시드 스크립트(`backend/src/main/resources/db/demo/fridge_exhibition_items.sql`)를 추가했다. `/admin/seed/fridge-demo` API가 이 스크립트를 호출해 `전시 데모:` 접두사의 물품 7건을 교체하도록 변경했으며, 운영 데이터에는 절대 실행하지 않도록 문서와 UI에 경고를 남겼다.
- **테스트 계획**
  - `./gradlew test --tests com.dormmate.backend.modules.fridge.FridgeIntegrationTest`
  - `npm run lint` (Next.js lint로 TS/ESLint 경고 확인)
  - 수동: 거주자 계정으로 슬롯 선택 모달 확인(잠금/비활성 칸 비활성 표시) + 관리자 화면에서 전체 칸 조회 유지.
- **리스크/의존성**: `SlotSelector`는 관리자·검사자 화면에서도 재사용되므로 기본 prop 미전달 시 동작이 바뀌지 않아야 한다. React 훅 의존성 배열 변경 시 Next lint가 경고를 낼 수 있어 리팩터링 시 주의가 필요하다.
- **진행 로그**
  - 2025-10-31: `SlotSelector` 중복 선언을 제거하고 `useMemo`, `aria-disabled`로 잠금/비활성 상태 노출 방식을 일관되게 보강.
  - 2025-10-31: 층별장·관리자가 같은 층/모든 칸의 묶음을 열람하되 메모는 오너에게만 노출되도록 백엔드 권한과 DTO 마스킹 로직을 보완하고, 통합 테스트(`floorManagerCanViewBundlesWithoutMemo`, `adminCanViewAllBundlesButMemoIsHidden`)를 추가.
  - 2025-10-31: 메모가 비공개 처리된 경우 프런트에서 “다른 사람 물품이라 가려졌어요~” 안내 문구를 노출하고, 관리자에게는 소유자 호실·이름 정보를 표시해 식별이 가능하도록 UX를 보완.
  - 2025-11-01: `InspectionService.startSession`에 층별장 담당 층 검증을 추가해 타 층 잠금이 불가능하도록 조정.
  - 2025-11-01: GitHub Actions 워크플로(`.github/workflows/ci.yml`)를 최신 자동화 스크립트에 맞게 재구성하고 백엔드/프런트/Playwright 테스트를 개별 스텝으로 분리.
  - 2025-11-01: `V3__update_admin_password.sql`에 `pgcrypto` 확장 생성을 추가해 신규 DB에서도 Flyway 마이그레이션이 실패하지 않도록 보완.
- **테스트**
  - `./gradlew test --tests com.dormmate.backend.modules.fridge.FridgeIntegrationTest`
    - (PASS, 2025-10-31 — 역할별 슬롯 필터 및 메모 마스킹 회귀 통과)
  - `npm run lint`
    - (PASS, 2025-10-31 — SlotSelector 리팩터링 후 TS/ESLint 경고 없음)


### FR-202 포장 등록 플로우 — In Progress (2024-11-24, Codex)
- **근거 문서**: `mvp-scenario.md §3.1`(거주자 등록 1~4단계), `feature-inventory.md §2`(허용량·라벨 정책), `data-model.md §4.2`(칸 용량·라벨 시퀀스).
- **현행 파악**
  - 서버 `FridgeService#createBundle`는 `max_bundle_count` 초과 시 422와 `CAPACITY_EXCEEDED` 코드를 반환하며, `ProblemResponse`가 `code` 필드를 포함해 프런트에서 식별 가능하다.
  - `FridgeIntegrationTest.maxBundleCountExceededReturns422`는 상태 코드뿐 아니라 `$.code`·`$.detail`에 `CAPACITY_EXCEEDED`가 담기는지를 검증하고 있다.
  - 프런트 `FridgeProvider#addBundle`는 허용량 초과 응답을 슬롯 메타 기반 문구로 가공하지만, 423(`COMPARTMENT_SUSPENDED` / `COMPARTMENT_LOCKED`)에 대해서는 원문 코드 문자열이 그대로 노출돼 사용자 메시지가 거칠다.
  - `AddItemDialog`는 수량·유통기한 검증과 남은 용량 안내를 제공하고 있으며, 성공 시 `bundleState`/`units`를 즉시 갱신해 목록/검색이 리프레시된다.
- **세부 작업**
  1. 423 응답(`COMPARTMENT_SUSPENDED`, `COMPARTMENT_LOCKED`, `COMPARTMENT_UNDER_INSPECTION`)을 받는 모든 포장 등록/수정 흐름에서 사용자 친화 메시지를 강제하도록 `FridgeProvider`와 관련 훅을 보완한다.
  2. 허용량 초과·칸 잠금 상황별 안내 문구를 상태 보드에 정의한 정책과 맞춰 재검토하고, 중복 코드가 있으면 util 함수로 정리한다.
  3. `FridgeIntegrationTest` 전체를 재실행해 422 응답 계약이 회귀하지 않는지 확인하고, 필요하면 API 문서(`FridgeController` OpenAPI 주석)와 동기화한다.
  4. 수동 검증: 포장 등록 → 허용량 초과 → 잠금/정지 칸 선택 시 메시지 확인, 등록 후 목록/검색 즉시 갱신 여부 확인.
- **테스트 계획**
  - `./gradlew test --tests com.dormmate.backend.modules.fridge.FridgeIntegrationTest.maxBundleCountExceededReturns422`
  - `./gradlew test --tests com.dormmate.backend.modules.fridge.FridgeIntegrationTest`
  - `npm run lint`
  - 수동: 거주자 계정으로 허용량 초과 및 잠금/중지 칸 안내 메시지 확인.
- **진행 로그**
  - 2025-11-01: `ProblemResponse`에 `code` 필드와 기본 메시지를 추가하고, 허용량 초과 통합 테스트에 응답 본문(`code`/`detail`) 검증을 보강.
  - 2025-11-01: `FridgeProvider#addBundle`에서 허용량 초과 시 슬롯 메타 기반 안내 문구를 노출하도록 개선.
  - 2025-11-01: `./gradlew test --tests ...capacityExceededReturnsUnprocessableEntity` 실행 시 원격 플러그인 다운로드 제한으로 빌드 실패 → 캐시 부재 환경에서 테스트 미실행.
  - 2025-11-01: `npm run lint` 실행 시 `next` 미설치로 실패(의존성 다운로드 불가 환경). 추후 CI/개발 환경에서 재확인 필요.
  - 2025-11-02: 423 상태 응답(`COMPARTMENT_SUSPENDED`/`COMPARTMENT_LOCKED`/`COMPARTMENT_UNDER_INSPECTION`)을 UI 헬퍼로 통합해 코드 문자열 대신 사용자 친화 문구가 노출되도록 개선.
  - 2025-11-02: `npm run lint` (PASS) — 새 헬퍼 도입 후 ESLint/TypeScript 경고 없음.
  - 2025-11-02: `./gradlew test --tests com.dormmate.backend.modules.fridge.FridgeIntegrationTest.maxBundleCountExceededReturns422 --offline` 실행 시 Gradle 배포판 다운로드가 필요해 네트워크 제한으로 실패(services.gradle.org 접근 불가). 로컬 캐시 확보 후 재시도 필요.
  - 2025-11-02: `./gradlew test --tests com.dormmate.backend.modules.fridge.FridgeIntegrationTest.capacityExceededReturnsUnprocessableEntity`
    - (PASS, 2025-11-02 — CAPACITY_EXCEEDED ProblemDetail 회귀 검증 완료)
  - 2025-11-02: `./gradlew test --tests com.dormmate.backend.modules.fridge.FridgeIntegrationTest`
    - (PASS, 2025-11-02 — 냉장고 통합 테스트 전체 회귀 통과)

### IN-304 거주자 검사 열람 뷰 — WIP (2025-11-02, Codex)
- **근거 문서**: `mvp-scenario.md §3.2`, `feature-inventory.md §2`, `docs/mvp-plan.md:IN-304`
- **현행 파악**
  - `/fridge/inspections` 및 `/fridge/inspections/{id}`는 현재 층별장/관리자 권한에 맞춰 구현되어 있으며, 거주자는 `FORBIDDEN_SLOT`으로 차단돼 검사 일정·결과를 열람할 수 없다.
  - `FridgeService#verifyBundleReadAccess`는 거주자의 `room_assignment`와 `compartment_room_access`를 기반으로 칸 접근을 제한하므로, 같은 로직을 검사 API에도 적용하면 본인 칸 데이터만 노출시킬 수 있다.
  - 프런트 검사 페이지는 기본적으로 검사 시작/조치 버튼이 활성화된 상태라 거주자에게 동일 UI가 노출되면 권한 오류(403)가 발생한다.
- **세부 작업**
  1. 검사 조회용 서비스/컨트롤러에 거주자 읽기 권한을 추가하고, 본인에게 배정된 칸만 필터링하도록 `room_assignment`와 `compartment_room_access` 기반 검증을 도입한다.
  2. 거주자 열람 플로우를 검증하는 통합 테스트(`residentCanViewOwnInspectionHistory`, `residentCannotViewOthersInspection`)를 추가한다.
  3. 프런트 `/fridge/inspections` 페이지에서 사용자 역할에 따라 버튼/액션을 비활성화하고, 검사 진행 현황·잠금 상태·조치 결과만 노출되도록 조건부 렌더링을 적용한다.
  4. 역할별 UI 분기 및 권한 오류 여부를 수동/Playwright 테스트로 확인하고, 결과를 로그에 기록한다.
- **테스트 계획**
  - `./gradlew test --tests com.dormmate.backend.modules.inspection.*`
  - `npm run lint`
  - 수동 또는 `npx playwright test --grep @inspection-resident` (신규 작성 예정)
- **리스크/의존성**: 검사 API 권한 확장 시 층별장/관리자 전용 메타데이터(예: 참여자 목록, 메모 등)가 거주자에게 노출되지 않도록 DTO 마스킹을 재검토해야 한다. `room_assignment` 또는 `compartment_room_access` 데이터가 누락된 계정은 여전히 403을 받게 되므로 시드 데이터 보정이 필요하다.
  - 2025-11-02: `InspectionService`에 거주자 접근 검증 로직과 `/fridge/inspections` GET 목록 API를 추가해 본인 칸만 열람하도록 제한.
  - 2025-11-02: `InspectionIntegrationTest`에 거주자 열람·차단 시나리오를 추가하고 샘플 데이터(배정/칸 매핑)를 보강.
  - 2025-11-02: `/fridge/inspections` 프런트 페이지를 거주자용 읽기 전용 뷰로 확장하고, 검사 이력/진행 현황 UI를 분기 구현.

- **테스트**
  - `./gradlew test --tests com.dormmate.backend.modules.fridge.FridgeIntegrationTest`
    - (PASS, 2025-10-31 — 역할별 슬롯 필터 및 메모 마스킹 회귀 통과)
  - `npm run lint`
    - (PASS, 2025-10-31 — SlotSelector 리팩터링 후 TS/ESLint 경고 없음)


### SC-401 검사 일정·이력 서버 관리 — WIP (2025-11-02, Codex)
- **근거 문서**: `mvp-plan.md:SC-401`, `feature-inventory.md §3`, `frontend/app/_components/home/use-home-state.ts`
- **현행 파악**
  - 일정/이력은 더 이상 브라우저 로컬스토리지에 저장하지 않고, 신규 테이블 `inspection_schedule`과 기존 `inspection_session`을 통해 서버에서 단일 소스로 관리된다.
  - `/fridge/inspection-schedules`·`/fridge/inspection-schedules/next` API가 관리자/거주자 모두에게 읽기 권한을 제공하며, 작성·수정·삭제는 관리자/층별장 역할로 제한된다.
  - 홈·냉장고·관리자 화면이 모두 새 API를 통해 다음 일정과 최근 검사 이력을 조회하도록 개편됐고, 데모 초기화 시 로컬스토리지 키를 비울 필요가 없어진다.
- **세부 작업**
  1. 관리자 UI에 일정 작성/완료 처리 플로우를 연결해 `inspection_schedule`에 대한 CRUD를 화면에서 수행하도록 한다.
  2. 일정-세션 연결(`inspection_session_id`)을 자동화하거나 검증 루틴을 추가해 제출 시점에 일정이 자동으로 완료 처리되도록 한다.
  3. 데모/운영 데이터 마이그레이션 가이드를 작성하고, 일정 이력 백업/복구 절차를 검토한다.
- **진행 로그**
  - 2025-11-02: Flyway `V13__inspection_schedule_schema.sql`로 `inspection_schedule` 테이블과 인덱스를 생성.
  - 2025-11-02: `InspectionScheduleService`·`InspectionScheduleController`를 추가해 `/fridge/inspection-schedules` CRUD 및 `/next` 조회 엔드포인트를 제공.
  - 2025-11-02: 프런트 `use-home-state`, 냉장고 페이지, 관리자 대시보드가 `fetchNextInspectionSchedule`/`fetchInspectionSchedules`/`fetchInspectionHistory` API로 전환되어 로컬스토리지 의존성을 제거.
  - 2025-11-02: 관리자 대시보드에서 일정 생성·완료·삭제를 UI로 수행하고, 검사 시작 화면에서 일정 선택 후 세션을 생성하면 `inspection_session_id`가 연결되도록 연계했다.
  - 2025-11-02: `InspectionService.submitSession`이 연결된 일정을 자동으로 `COMPLETED` 처리하도록 보강, 통합 테스트(`scheduleLinkedInspectionCompletesAutomatically`) 추가.
  - 2025-11-02: 검사 취소 시 연결된 일정이 다시 사용 가능하도록 `inspection_session_id`를 해제하고 상태를 `SCHEDULED`로 되돌리는 로직과 통합 테스트(`cancelInspectionReleasesSchedule`)를 추가.
- **테스트**
  - `./gradlew test --tests com.dormmate.backend.modules.inspection.InspectionScheduleIntegrationTest`
    - (PASS, 2025-11-02 — 일정 생성/조회/완료/삭제 플로우 검증)
  - `npm run lint`
    - (PASS, 2025-11-02 — 일정 API 연동 후 프런트 경고 없음)
