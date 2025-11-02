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
  - 리프레시 토큰을 SHA-256 해시로 저장하고 dev/prod 환경의 TTL을 7일로 통일해 재사용·유출 위험을 낮춤.
  - `ResponseStatusException` 발생 시 세션 폐기가 롤백되지 않도록 트랜잭션 전략(noRollbackFor) 조정 및 신규 동작 검증용 통합 테스트 추가.
  - 프런트 로그인/가드 UI에서 데모 계정 자동 로그인 요소를 제거하고 백엔드 `/auth/login` 흐름만 노출하도록 정비(`frontend/features/auth/components/login-panel.tsx`, `frontend/features/auth/components/auth-guard.tsx` 등).
- **테스트**
  - `./gradlew test --tests com.dormmate.backend.modules.auth.AuthServiceTest`
    - (PASS, 2025-11-01 — 디바이스 저장·만료 세션 폐기·기기 불일치 차단 시나리오 검증)
- **후속 과제**: 가입/승인(AU-101~103) 구현 시 비밀번호 변경·탈퇴와 연동해 전체 세션 폐기 기능을 확장해야 한다.

- **추가 로그**: CI OpenAPI 드리프트 체크 단계가 관리자 로그인 후 토큰으로 `/v3/api-docs`를 호출하도록 갱신됐다(`.github/workflows/ci.yml`).

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
 5. `GET /fridge/slots?view=full&page=0&size=20` 호출 시 `occupiedCount`·`totalElements`가 기대대로 내려오는지 확인하고, 등록/삭제 후 값이 즉시 반영되는지 확인한다.
- 2025-11-02: 관리자 전용 전시 물품 시드 스크립트(`backend/src/main/resources/db/demo/fridge_exhibition_items.sql`)를 추가했다. `/admin/seed/fridge-demo` API가 이 스크립트를 호출해 `전시 데모:` 접두사의 물품 7건을 교체하도록 변경했으며, 운영 데이터에는 절대 실행하지 않도록 문서와 UI에 경고를 남겼다.
- **테스트 계획**
  - `./gradlew test --tests com.dormmate.backend.modules.fridge.FridgeIntegrationTest`
  - `npm run lint` (Next.js lint로 TS/ESLint 경고 확인)
  - 수동: 거주자 계정으로 슬롯 선택 모달 확인(잠금/비활성 칸 비활성 표시) + 관리자 화면에서 전체 칸 조회 유지.
  - `curl -s -H "Authorization: Bearer <token>" "http://localhost:8080/fridge/slots?view=full&page=0&size=20"` — `occupiedCount`·`totalElements` 필드 스팟 확인, 등록/삭제 후 재호출.
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
  4. 수동 검증: 포장 등록 → 허용량 초과 → 잠금/정지 칸 선택 시 메시지 확인, 등록 후 목록/검색/페이지네이션(`page`,`size`) 즉시 갱신 여부와 `occupiedCount` 변화 확인.
- **테스트 계획**
  - `./gradlew test --tests com.dormmate.backend.modules.fridge.FridgeIntegrationTest.maxBundleCountExceededReturns422`
  - `./gradlew test --tests com.dormmate.backend.modules.fridge.FridgeIntegrationTest`
  - `npm run lint`
  - 수동: 거주자 계정으로 허용량 초과 및 잠금/중지 칸 안내 메시지 확인, 등록 직후 `GET /fridge/slots?view=full&page=0&size=20` 호출로 `occupiedCount` 업데이트 확인.
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


### FR-204 검사 후 수정 추적·벌점 안내 — In Progress (2025-11-01, Codex)
- **근거 문서**: `mvp-plan.md:FR-204`, `mvp-scenario.md §3.3`
- **변경 사항**
  - `penalty_history` 테이블과 도메인을 추가하고, 검사 조치 중 폐기(`DISPOSE_EXPIRED`, `UNREGISTERED_DISPOSE`)에 대해 자동으로 벌점(1점)을 기록하도록 구현.
  - `InspectionSessionResponse`가 `actions` 배열을 포함하도록 확장돼 각 조치의 메모, 스냅샷(`inspection_action_item`), 벌점 내역을 내려준다.
  - 프런트 타입/매퍼(`frontend/features/inspections/api.ts`)를 갱신해 새 필드(`actions / items / penalties`)를 파싱하고, 알림·상세 화면 연동 준비.
- **테스트**
  - `./gradlew test` — (PASS, 2025-11-01) 검사·알림 통합 테스트 업데이트 후 전체 백엔드 테스트 통과.
  - `npm run lint` — (PASS, 2025-11-01) 신규 타입 반영 후 프런트 ESLint 클린.
- **TODO**: UI에서 조치 상세/벌점 모달 표현을 확정하고, Playwright 시나리오에 검사 후 배지/벌점 확인 절차를 추가한다.

### NO-401 검사 결과 알림 발행 — In Progress (2025-11-01, Codex)
- **근거 문서**: `mvp-plan.md:NO-401~403`
- **변경 사항**
  - 알림 생성 시 `correlationId`를 검사 세션 ID로 저장하고, 메타데이터에 `sessionId`, `actionIds`, `actionItemIds`, `penaltyHistoryIds` 배열을 포함하도록 `NotificationService` 보강.
  - 중복 방지·알림 비활성화 시나리오 통합 테스트를 갱신해 신규 필드를 검증.
- **테스트**
  - `./gradlew test --tests com.dormmate.backend.modules.notification.NotificationServiceIntegrationTest`
    - (PASS, 2025-11-01 — correlationId/metadata 포함 여부 확인)


### SC-401 검사 일정·이력 서버 관리 — WIP (2025-11-02, Codex)
- **근거 문서**: `mvp-plan.md:SC-401`, `feature-inventory.md §3`, `frontend/app/_components/home/use-home-state.ts`
- **현행 파악**
  - 일정/이력은 더 이상 브라우저 로컬스토리지에 저장하지 않고, 신규 테이블 `inspection_schedule`과 기존 `inspection_session`을 통해 서버에서 단일 소스로 관리된다.
-  `/fridge/inspection-schedules`·`/fridge/inspection-schedules/next` API가 관리자/거주자 모두에게 읽기 권한을 제공하며, 작성·수정·삭제는 층별장 역할에 한정한다. **MVP에서는 층별장 UI에서 책임 구역 칸 단위 일정 생성·수정·완료 플로우를 제공**하고, 관리자는 조회 전용으로 유지한다.
-  홈·냉장고·관리자 화면이 모두 새 API를 통해 다음 일정과 최근 검사 이력을 조회하도록 개편됐고, 데모 초기화 시 로컬스토리지 키를 비울 필요가 없어진다.
- **세부 작업**
  1. 층별장 일정 생성/수정 UI를 마무리하고, 일정 생성 시 거주자 알림 흐름과 감사 로그를 연동한다.
  2. 일정-세션 연결(`inspection_session_id`) 검증과 중복 예약 방지 규칙을 강화해 다중 층별장이 동시에 예약해도 충돌하지 않도록 한다.
  3. (Post-MVP) 관리자 일정 등록/수정 플로우를 확장하고, 일정 생성 시 담당 층별장에게 알림을 발송하도록 구현한다.
  4. 데모/운영 데이터 마이그레이션 가이드를 작성하고, 일정 이력 백업/복구 절차를 검토한다.
  5. 층별장 `/fridge/inspections` 화면을 “예정된 검사 / 검사 기록” 이중 섹션으로 재구성하고, 헤더 액션(일정 추가)·일정별 3dot 메뉴(수정/삭제)를 제공한다.
- **진행 로그**
  - 2025-11-02: Flyway `V13__inspection_schedule_schema.sql`로 `inspection_schedule` 테이블과 인덱스를 생성.
  - 2025-11-02: `InspectionScheduleService`·`InspectionScheduleController`를 추가해 `/fridge/inspection-schedules` CRUD 및 `/next` 조회 엔드포인트를 제공.
  - 2025-11-02: 프런트 `use-home-state`, 냉장고 페이지, 관리자 대시보드가 `fetchNextInspectionSchedule`/`fetchInspectionSchedules`/`fetchInspectionHistory` API로 전환되어 로컬스토리지 의존성을 제거.
  - 2025-11-02: 층별장 일정 생성·완료·삭제 UI를 연결해 검사 시작 화면에서 일정 선택 후 세션을 생성하면 `inspection_session_id`가 연동되도록 구성했다.
  - 2025-11-02: `InspectionService.submitSession`이 연결된 일정을 자동으로 `COMPLETED` 처리하도록 보강, 통합 테스트(`scheduleLinkedInspectionCompletesAutomatically`) 추가.
  - 2025-11-02: 검사 취소 시 연결된 일정이 다시 사용 가능하도록 `inspection_session_id`를 해제하고 상태를 `SCHEDULED`로 되돌리는 로직과 통합 테스트(`cancelInspectionReleasesSchedule`)를 추가.
  - 2025-11-02: 관리자 화면은 조회 전용으로 유지하고, Post-MVP에서 관리자 일정 등록·알림 플로우를 확장하기 위한 메모를 `mvp-scenario.md`에 기록했다.
  - 2025-11-03: 층별장 `/fridge/inspections` UI를 예정된 검사/검사 기록 섹션으로 분리하고, 일정 추가 버튼·기존 3dot 메뉴 기반 수정/삭제 흐름을 설계(구현 착수).
  - 2025-11-03: 검사 일정 목록에 세로 3dot 메뉴와 `검사 중` 버튼을 배치하고, 별도 “진행 중” 섹션을 제거한 뒤 활성 일정은 배경색으로 강조되며 버튼/취소 액션을 동일 카드에서 처리하도록 개편.
- **테스트**
- `./gradlew test --tests com.dormmate.backend.modules.inspection.InspectionScheduleIntegrationTest`
  - (PASS, 2025-11-02 — 일정 생성/조회/완료/삭제 플로우 검증)
- `npm run lint`
  - (PASS, 2025-11-02 — 일정 API 연동 후 프런트 경고 없음)

### AD-601 칸 설정·통계 — WIP (2025-11-03, Codex)
- **근거 문서**: `mvp-plan.md:AD-601`, `docs/design/admin-wireframes.md §1~4`, `feature-inventory.md §5 냉장고 – 관리자`, `docs/ops/batch-notifications.md`
- **현행 파악**
  - `/admin` 루트는 거주자 하단 탭·BottomNav 중심 구조를 그대로 사용해 와이어프레임의 헤더·좌측 내비게이션·우측 퀵 액션 패턴이 구현돼 있지 않다.
  - 냉장고 관리 화면은 카드/아코디언 기반 칸 뷰 대신 관리 허브 카드로만 연결되고 있어 검사 요약·물품 상세·잠금 토글·감사 로그 딥링크 UX가 부재하다.
  - 대시보드 KPI와 층별 요약 데이터가 비워져 있어 `useAdminDashboard`가 제공하는 summary/timeline/quickActions를 소비하지 못한다.
  - 백엔드 `FridgeReallocationService`는 균등 분배 추천까지는 구현되어 있으나, 요청 시 **잔여 호실 분배/비활성 칸 제외** 시나리오 검증과 `Problem.type` 기반 오류 코드 표준화가 부족하다. 또한 냉동 칸 공용 검증이 전용 에러 코드 없이 `SHARED_*` 문자열에 머무른다.
  - `/fridge/bundles` 조회는 서비스 단에서 메모리 필터링을 수행해 `owner=all` 요청 시 대량 데이터 로딩, 검색어 대·소문자 혼합, 삭제 플래그 조합 회귀 테스트가 부재하다.
  - `NotificationService`는 `FRIDGE_RESULT`만 선호도로 등록돼 있어 임박/만료 정책(`docs/ops/batch-notifications.md`)을 프런트 토글과 연동하지 못하고, API 응답(재배분/검사/삭제 이력)에도 감사 로그용 ID/타임스탬프가 누락된다.
- **세부 작업**
  1. `/admin` 전용 레이아웃을 헤더(검색·알림·프로필) + 좌측 사이드 내비 + 메인 캔버스 + 우측 퀵 액션 패널로 구축하고, 1440/1024/768 브레이크 포인트 대응을 Tailwind 유틸 클래스로 구성한다.
  2. 대시보드 페이지를 KPI 카드 그리드, 모듈 탭(냉장고/세탁실/도서관/다목적실), 운영 워치리스트, 최근 이벤트 타임라인, 퀵 액션 패널로 재구성해 `useAdminDashboard` 응답을 시각화한다.
  3. 냉장고 모듈 화면을 칸 카드 뷰로 구현해 층/유닛 필터, 상태·잠금 표시, 검사 요약/물품 상세 아코디언, 감사 로그/재배분 버튼을 포함하고 `fetchAdminResources` 데이터를 연결한다. mock 데이터일 경우에도 UI가 동작하도록 빈 상태 처리 문구를 추가한다.
  4. 대시보드와 냉장고 화면에서 재사용할 층별 통계·칸 상태 위젯을 공통 컴포넌트로 분리해 추후 API 확장 시 유지보수를 용이하게 한다.
  5. `FridgeReallocationService`에 대한 검증 로직을 보강해 층 외 호실, 중복 할당, 냉동칸 커버리지 오류에 대해 RFC7807 `type` 필드를 `urn:problem:dormmate:*` 패턴으로 반환하고, OpenAPI/통합 테스트를 추가한다.
  6. `/admin/fridge/reallocations/preview|apply` 통합 테스트를 다층·검사 중 잠금·냉동 칸 공용·잔여 분배 케이스까지 확장하고, 회귀 시나리오를 `FridgeReallocationIntegrationTest`에 정리한다.
  7. `/fridge/bundles` 검색/페이징 테스트를 작성해 라벨/삭제 플래그/slot 확장 조합을 검증하고, 필요 시 JPA 쿼리 최적화 및 페이징 분기(`owner=all`)를 도입한다.
  8. `NotificationService`에 `FRIDGE_EXPIRY`/`FRIDGE_EXPIRED` 기본 선호를 정의하고 `docs/ops/batch-notifications.md` 재시도 정책과 API 응답 메타데이터(감사 로그 키, 타임스탬프)를 동기화한다.
- **테스트 계획**
  - `npm run lint`
  - `npx playwright test --grep @admin` (또는 수동으로 KPI/카드 뷰 렌더링 확인)
  - `./gradlew test --tests *FridgeReallocationIntegrationTest`
  - `./gradlew test --tests com.dormmate.backend.modules.fridge.FridgeIntegrationTest.*Search*`
  - `./gradlew test --tests com.dormmate.backend.modules.notification.*`
- **테스트 로그**
  - `./gradlew test --tests *FridgeReallocationIntegrationTest`
    - (PASS, 2025-11-02 — ProblemException 전환 및 재배분 검증 경계 케이스 통과)
  - `./gradlew test --tests com.dormmate.backend.modules.fridge.FridgeIntegrationTest.adminBundleSearchSupportsKeywordAndCaseInsensitiveMatch`
    - (PASS, 2025-11-02 — 관리자 키워드 검색·대소문자 처리 회귀 확인)
  - `./gradlew test --tests com.dormmate.backend.modules.fridge.FridgeIntegrationTest.adminBundleSearchSupportsLabelLookup`
    - (PASS, 2025-11-02 — 라벨 검색 및 slot 확장 시 결과 정합성 확인)
  - `./gradlew test --tests com.dormmate.backend.modules.fridge.FridgeIntegrationTest.adminBundleListWithDeletedFilterReturnsOnlyDeletedBundles`
    - (PASS, 2025-11-02 — status=deleted 필터 시 삭제 건만 반환됨을 검증)
  - `./gradlew test --tests com.dormmate.backend.modules.notification.NotificationServiceTest --tests com.dormmate.backend.modules.notification.FridgeExpiryNotificationSchedulerIntegrationTest`
    - (PASS, 2025-11-02 — 임박/만료 알림 선호 기본값·배치 메타데이터·FAILED dispatch 로그 적재 검증)
  - `./gradlew test`
    - (PASS, 2025-11-02 — 재배분/검색/알림 확장 이후 백엔드 전체 회귀 통과)

### AD-602 역할 관리 — WIP (2025-11-03, Codex)
- **근거 문서**: `mvp-plan.md:AD-602`, `docs/design/admin-wireframes.md §6`, `feature-inventory.md §5`
- **현행 파악**
  - 권한·계정 화면은 2열 테이블+드로어 형태이며, 층별장 임명/해제 및 진행 중 검사 세션 예외 안내, 알림 템플릿 안내가 토글 버튼 수준에서 멈춰 있다.
  - 와이어프레임이 요구하는 좌측 필터 패널, 중앙 목록, 우측 상세 패널 3열 구조와 저장된 필터/즐겨찾기 UX가 없다.
- **세부 작업**
  1. 상단 필터 바 + 좌측 필터 패널 + 중앙 테이블 + 우측 상세 패널 구조로 재구성하고, URL 쿼리로 필터 상태를 동기화한다.
  2. 층별장 임명/해제·관리자 승격·계정 비활성화를 단계별 다이얼로그(사유 입력, 진행 중 검사 세션 경고, 알림 발송 안내)로 구현하고, 감사 로그 기록용 메타데이터를 포함하도록 API 호출 구조를 정리한다. 백엔드 연동 전까지는 mock 응답과 토스트로 대체한다.
  3. 사용자 상세 패널에 검사/벌점 요약, 최근 알림, 감사 로그 바로가기 버튼을 추가하고 필수 접근성(label/aria) 속성을 적용한다.
  4. 역할 변경 → UI 반영을 검증할 수 있는 Playwright `@admin-roles` 태그 시나리오 초안을 작성하고, 자동화 전까지는 수동 검증 로그를 남긴다.
- **테스트 계획**
  - `npm run lint`
  - `npx playwright test --grep @admin-roles` (작성 전에는 수동으로 필터·액션 확인)

### AD-603 운영 도구 확장 — WIP (2025-11-01, Codex)
- **근거 문서**: `mvp-plan.md:AD-603`, `mvp-scenario.md §3.5`, `ai-impl/frontend.md` 관리자 IA 섹션
- **현행 파악**
  - 관리자 화면은 거주자·층별장과 동일한 하단 탭을 공유하되, `관리(⚙️)` 허브에서 자원/권한/알림/벌점/리포트를 중앙 집중 관리하는 하이브리드 IA로 합의되었다(`docs/mvp-plan.md:279`).
  - `docs/ai-impl/frontend.md`에 FilterBar/PaginatedTable/DetailsDrawer/BulkEditor/DangerZoneModal 공통 컴포넌트 사용 지침을 추가했고, Phase 2 모듈은 Feature Flag(`ADMIN_MODULE_FLAGS`)로 제어한다.
- **세부 작업**
  1. [x] `frontend/components/admin`에 공통 컴포넌트 스켈레톤을 생성하고, Storybook 예제(`admin.stories.tsx`)로 사용 예시를 남긴다.
  1-1. [x] `frontend/app/admin/components-gallery` 페이지를 추가해 Storybook 없이도 컴포넌트 시각 검증이 가능하도록 한다.
  2. [x] 관리자 메인/자원 관리/권한·계정 화면 와이어프레임을 텍스트 문서(`docs/ai-impl/frontend-admin-wireframes.md`)로 공유하고, 승인 후 구현 순서를 결정한다.
  3. 관리자 빠른 실행 카드가 기존 Drawer 폼을 재사용하도록 UX 흐름을 점검하고, 감사 로그 트래킹(source=shortcut|hub) 스펙을 정의한다.
  4. 위험 액션(칸 증설, 라벨 조정, 벌점 수정, 데모 Seed 실행)을 DangerZoneModal로 통일하고, prod 빌드에서 기본 비활성화 플래그를 확인한다.
  5. [x] 관리자 핵심 Playwright 시나리오와 `@admin` 태그 구조를 `docs/tests/admin-playwright-plan.md`에 정리한다.
  6. [x] Playwright 공통 헬퍼(`tests/e2e/utils/admin.ts`)와 관리자 스토리지 생성 스크립트(`scripts/create-admin-storage.mjs`)를 추가한다.
  7. [x] 백엔드 관리자 대시보드/자원/사용자/정책 조회 API를 구현하고 통합 테스트로 보호한다.
  8. [x] 관리자 냉장고 포장 조회에서 in-memory 페이징을 제거하고, 삭제 이력은 3개월 한정 팝업용 전용 API로 분리한다. (2025-11-03 완료)
- **진행 로그**
- 2025-11-01: `docs/mvp-plan.md:279`에 하이브리드 IA 합의 메모 추가.
- 2025-11-01: `docs/ai-impl/frontend.md`에 관리자 IA & 공통 컴포넌트 전략 섹션 추가(FilterBar/PaginatedTable/DetailsDrawer 재사용, 도메인 계산 서버 집중, Feature Flag 지침 포함).
- 2025-11-01: `frontend/app/admin/components-gallery` 페이지를 추가해 공통 컴포넌트 시각 확인 및 QA 대비 문서를 마련.
- 2025-11-01: Playwright 헬퍼(`tests/e2e/utils/admin.ts`)와 관리자 스토리지 생성 스크립트(`scripts/create-admin-storage.mjs`)를 추가하고, `playwright.config.ts`에 storage state/grep 환경 변수 지원을 확장.
- 2025-11-01: 관리자 대시보드/관리 허브/자원·권한·정책·리포트·운영 도구 페이지를 구현해 하단 탭-관리 허브 분리 구조를 UI로 반영.
- 2025-11-01: 관리자 대시보드/자원/권한/정책 화면을 `frontend/features/admin/hooks` 기반 데이터 훅으로 전환하고, 실제 API 부재 시 mock 데이터를 단일 위치에서 공급하도록 정리.
- 2025-11-02: `/admin/dashboard`, `/admin/resources`, `/admin/users`, `/admin/policies` API를 추가해 프런트엔드가 실제 데이터를 조회하고, `AdminReadIntegrationTest`로 권한 및 응답 구조를 검증.
- 2025-11-03: 냉장고 포장 목록 조회 성능 이슈 분석 완료 — DB 레벨 검색/페이징 + 삭제 이력 전용 팝업 API 분리 계획 수립.
- 2025-11-03: `FridgeBundleRepository#searchBundles`를 네이티브 쿼리 기반 페이지네이션으로 재구성하고, `/admin/fridge/bundles/deleted` API를 추가해 3개월 한정 삭제 이력을 분리. `./gradlew test`로 회귀 테스트 통과.

### FR-305 칸 증설/재배분 자동화 — WIP (2025-11-03, Codex)
- **근거 문서**: `mvp-plan.md` 냉장고 증설 체크리스트, `feature-inventory.md §5` 냉장고 관리자 정책, `docs/data-model.md` `compartment_room_access`
- **현행 파악**:
  - `compartment_room_access`는 초기 시드 이후 수동 유지되고, 서비스 계층에서는 읽기 검증(`FridgeService#verifyBundleReadAccess`, `InspectionService#ensureCompartmentAccess`)에만 사용된다.
  - 냉장고 증설 및 층별 호실 재배분 로직이 비어 있어, 관리자 도구에서 증설 시 수동 SQL 또는 외부 도구가 필요하다.
  - 데이터 무결성: `compartment_room_access`는 `(fridge_compartment_id, room_id)` 중복을 막는 유니크 제약과 `released_at`으로 소프트 종료를 표현한다.
- **세부 진행**
  1. [x] 관리자 `POST /admin/fridge/reallocations/preview` 구현 — 층별 칸/호실 현황을 불러와 라운드 로빈으로 균등 분배 추천, CHILL/ FREEZE 구분 반영.
  2. [x] 프리뷰 응답에 현재 배정, 추천 배정, 경고 목록(비활성/잠금 칸)을 포함.
  3. [x] `POST /admin/fridge/reallocations/apply` 구현 — 트랜잭션 내 기존 배정 `released_at` 마킹 후 신규 배정 삽입, 중복/미배정 검증.
  4. [x] 진행 중 검사 세션/잠금 칸에 대한 별도 충돌 코드(`COMPARTMENT_IN_USE`)를 반환하도록 재배분 적용 로직과 프리뷰 경고를 보강.
  5. [x] 통합 테스트(`FridgeReallocationIntegrationTest`)로 프리뷰→확정 플로우, 권한 차단, DB 결과 검증.
- **테스트**
  - `./gradlew test`
- **추가 TODO**: 감사 로그 테이블/이벤트 도입 여부 검토, 프런트 연동 시 diff 하이라이트/수정 UI 요구사항 수집.
- **테스트 계획**
- `npx playwright test --list --grep @admin` — 관리자 Playwright 태그 체계를 정의한 뒤 목록 확인.
- `npm run lint` (frontend) — 공통 컴포넌트 추가 시 스타일/ESLint 검증.
- `npm run playwright:create-admin-storage` — 관리자 storage state를 재생성해 E2E 실행에 사용.
- **리스크/의존성**: 기존 관리자 화면과 신규 공통 컴포넌트가 혼재할 수 있으므로 점진적 릴리즈가 필요하다. DangerZone 기능은 운영 환경에서 접근 제한을 유지하고, Feature Flag 미설정 시 새 모듈은 표시되지 않도록 가드한다.

### NO-403 알림 목록/설정 API — WIP (2025-11-03, Codex)
- **근거 문서**: `docs/mvp-plan.md` NO-403, `feature-inventory.md §3`(알림 & 일정)
- **세부 작업**
  1. [x] `GET /notifications` 구현 — 미읽음 우선 정렬, TTL 만료 자동 처리, 페이지네이션/미읽음 카운트 제공.
  2. [x] `PATCH /notifications/{id}/read`, `PATCH /notifications/read-all` 추가로 읽음 처리 플로우 지원.
  3. [x] `GET /notifications/preferences`, `PATCH /notifications/preferences/{kind}`로 종류별 ON/OFF·백그라운드 토글 제어.
  4. [ ] 알림 종류 추가 시 `SUPPORTED_PREFERENCES` 정의 및 프런트 문구 동기화.
  5. [x] 프런트: OpenAPI 타입 재생성 후 알림 목록/읽음/설정 API 클라이언트와 상태 훅을 구현한다. UI 노출은 추후 합의 후 진행.
  6. [x] 프런트: 목록 호출 시 `state` 파라미터 정규화, 읽음 처리(단일/전체), 설정 토글을 테스트 가능하도록 유닛/통합/Playwright 시나리오 후보를 정리한다.
  7. [ ] QA 체크리스트: unread → read-all → preference 토글 → 401/403 에러 핸들링 흐름을 수동/자동 테스트 항목으로 문서화한다.
- **진행 로그**
  - 2025-11-03: `NotificationService` 조회/읽음/설정 메서드 확장, `NotificationController` 및 DTO 추가.
  - 2025-11-03: `NotificationControllerIntegrationTest`로 목록·읽음·설정·TTL 만료 시나리오 검증.
  - 2025-11-12: 프런트 연동 범위 확정 — 알림 REST API 전면 연동, UI는 추후 협의. OpenAPI 스키마(`NotificationListResponse`, `NotificationPreferenceResponse`, `NotificationPreferenceItem`, `UpdateNotificationPreferenceRequest`) 기준으로 타입 재생성 완료.
  - 2025-11-12: `feature-inventory.md §3`, `nogitReadME.md` 알림 항목을 재검토해 알림 종류·TTL·설정 옵션 목록을 정리하고 헤더 드롭다운 UX 요구사항 초안을 수립.
  - 2025-11-12: 헤더 알림 벨 드롭다운 구현 착수 — `NotificationBell` 컴포넌트/스토어 확장(`ensureLoaded`, `refresh`)으로 미읽음 배지·필터·모두 읽음 액션을 지원하고 홈 헤더에 연결.
- **테스트**
  - `./gradlew test --tests *NotificationControllerIntegrationTest`
  - `npm run lint`
    - (PASS, 2025-11-12 — 프런트 알림 스토어/훅 추가 후 ESLint 경고 없음)

### NO-501 배치 알림 생성 — WIP (2025-11-03, Codex)
- **근거 문서**: `docs/mvp-plan.md` NO-501, `feature-inventory.md §3`
- **세부 진행**
  1. [x] 스케줄러 설정(`@EnableScheduling`)을 추가하고 09:00 cron 배치를 구성했다.
  2. [x] `FridgeExpiryNotificationScheduler`에서 임박(3일 이내)/만료 물품을 사용자별로 집계하고 `FRIDGE_EXPIRY`·`FRIDGE_EXPIRED` 알림을 생성하며 dedupe 키와 24시간 TTL을 적용했다.
  3. [x] 생성된 알림은 `NotificationDispatchLog`에 `INTERNAL_BATCH` 채널 성공 로그로 기록된다.
  4. [ ] 배치 실패 재시도/오류 코드 정책 문서화 및 관리자 알림 연동. (TODO: `docs/ops/batch-notifications.md` 기반)
- **진행 로그**
  - 2025-11-03: 임박/만료 배치 서비스 구현, dedupe/TTL 정책 반영, `FridgeExpiryNotificationSchedulerIntegrationTest`로 검증.
- **테스트**
  - `./gradlew test --tests *FridgeExpiryNotificationSchedulerIntegrationTest`


프런트 개선

프런트 전달사항
* 백엔드 /fridge/bundles가 이제 DB 레벨에서 정렬·검색·페이징을 처리합니다. 기존 쿼리 파라미터(slotId, owner, status, search, page, size) 계약은 그대로이므로 추가 수정 없이 동작하지만, 검색어는 trim() 후 전달해 주세요(라벨 A003·A-003·품목명 모두 지원).
* 관리자용 삭제 이력 전용 API가 추가되었습니다: GET /admin/fridge/bundles/deleted?since&size&page.
    * since 미지정 시 자동으로 “현재 시각 - 3개월”부터 조회합니다.
    * 응답 스키마는 BundleListResponse 그대로이고, 각 항목에 deletedAt(JSON 키는 deletedAt, DTO 내부에서 removedAt/deletedAt 공존 시 그대로 노출됨)을 포함합니다. 팝업 목록에서는 이 필드를 노출해 주세요.
* 보안 설정상 /admin/fridge/** 경로는 ADMIN 역할만 접근 가능합니다. 프런트에서 관리자 팝업을 띄울 때 해당 토큰이 있는지 확인하고, 403이 오면 권한 안내 문구를 표시해주세요.
* 기존 목록과 삭제 이력 팝업 간 상태 필터를 분리했으니, 메인 목록에서는 계속 status=active 기본 값으로 호출하고, 삭제 이력 팝업에서만 새 API를 사용하면 됩니다. 오래된 이력을 보고 싶을 때는 since를 과거 일시로 내려 주면 됩니다.
* 백엔드 테스트는 cd backend && ./gradlew test로 검증 완료됐습니다. 프런트 연동 시 E2E 테스트에 관리자 시나리오(@admin)가 있다면 /admin/fridge/bundles/deleted 호출을 추가해 주세요.


칸 재배분 관련 프런트 전달사항
* 신규 API
    * POST /admin/fridge/reallocations/preview: 층 번호(floor)만 보내면 현재 배정/추천 배정/경고 목록을 내려줍니다. 각 항목에는 currentRoomIds, recommendedRoomIds, warnings(잠금/검사 중 상태) 등이 포함됩니다.
    * POST /admin/fridge/reallocations/apply: 층 번호 + 수정한 allocations(칸 ID와 최종 roomId 배열)를 전달하면 확정합니다. 성공 시 적용된 칸 수, 생성/종료된 배정 수, appliedAt가 반환됩니다.
* 권한/에러
    * 두 API 모두 ADMIN만 호출 가능합니다. 403 발생 시 관리자 인증을 확인하세요.
    * 잠금(is_locked) 또는 검사 진행(INSPECTION_IN_PROGRESS) 칸을 포함하면 409 COMPARTMENT_IN_USE가 돌아옵니다. 프리뷰에 경고가 함께 내려오니 UI에서 사전 안내해 주세요.
* 프런트 처리 포인트
    * 프리뷰 응답을 기본값으로 렌더링한 뒤 관리자가 수정할 수 있게 하고, 최종 확정 시 recommendedRoomIds 대신 수정된 값을 roomIds에 넣어 apply 호출하세요.
    * 프리뷰 카드에 warnings 배열을 그대로 표시해 잠금/검사 중 칸을 강조하면 좋습니다.
    * 적용 성공 후에는 프리뷰를 다시 호출하거나 슬롯/접근 데이터를 재조회해 UI를 리프레시해 주세요.
* 테스트 참고
    * 백엔드 측은 FridgeReallocationIntegrationTest로 행복/에러 경로를 검증했습니다. 프런트도 관리자 시나리오 E2E에 잠금/검사 중 케이스를 추가해 주세요.


* 알림 REST API가 준비됐어요. GET /notifications?state=all|unread|read&page&size로 미읽음 우선 정렬 목록을 받을 수 있고, 응답에는 items[], page/size/totalElements, unreadCount가 포함됩니다. TTL이 지난 항목은 호출 시 자동으로 EXPIRED 처리되므로 목록에는 내려오지 않아요.
* 읽음 처리는 두 가지입니다. PATCH /notifications/{id}/read(단일)와 PATCH /notifications/read-all(전체 미읽음). 이미 읽었거나 만료된 알림에 대해 중복 호출해도 409 없이 NoContent가 돌아갑니다.
* 알림 설정은 GET /notifications/preferences에서 기본값(지금은 FRIDGE_RESULT 1종)을 내려주고, PATCH /notifications/preferences/{kindCode}로 enabled/allowBackground를 토글할 수 있습니다. 요청 바디는 { "enabled": true|false, "allowBackground": true|false } 형태고, 응답은 갱신된 항목 한 건입니다.
* OpenAPI 명세(api/openapi.yml)가 갱신돼 있으니 프런트 타입 정의/SDK를 재생성해 주세요. 신규 스키마 이름은 NotificationListResponse, NotificationPreferenceResponse, NotificationPreferenceItem, UpdateNotificationPreferenceRequest입니다.
* 테스트로 NotificationControllerIntegrationTest를 추가했으니, 프런트에서도 목록/읽음/설정 시나리오를 QA할 때 참고하면 좋겠습니다.



* 09:00 임박/만료 알림이 서버 배치로 생성되기 시작했습니다. FRIDGE_EXPIRY(D-3 이내), FRIDGE_EXPIRED(이미 지난 항목) 두 종류가 하루 한 번 생성되며 dedupe 키({kind}:{userId}:{yyyyMMdd})와 24시간 TTL로 중복을 막습니다. 알림 본문에는 개수와 최대 3개 샘플 품목명이 포함됩니다.
* 알림이 프런트로 내려오면 기존 GET /notifications 목록 API로 그대로 전달되므로 추가 API 연동은 없습니다. 다만 임박/만료 알림이 새로 생성되면, UI에서 사용자에게 배지/강조 색상 등을 적용할 때 kind 코드로 분기해 주세요.
* 실패 로그는 NotificationDispatchLog에 INTERNAL_BATCH 채널과 EXPIRY_BATCH_FAILED/EXPIRED_BATCH_FAILED 코드로 쌓입니다. 필요하면 관리자 화면에서 해당 로그를 조회할 수 있도록 연동할 계획입니다.
* 재시도 정책(5분 간격 최대 3회)과 운영 지침은 docs/ops/batch-notifications.md에 정리되어 있으니, 프런트에서 관리자 알림 등 후속 기능을 설계할 때 참고해주세요.
