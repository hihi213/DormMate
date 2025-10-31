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
- **리스크/의존성**: Flyway 플러그인 10.x가 buildscript classpath에 PostgreSQL 플러그인을 요구하므로 신규 버전 반영 시 플러그인 아티팩트 캐시 유무를 확인해야 함. CLI/Gradle 간 버전 불일치 발생 시 재현 가능.

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

### FR-202 포장 등록 플로우 — WIP (2024-11-24, Codex)
- **현행 파악**: 서버/프런트 모두 기존 구현만 검증했고, 포장 등록 기능 자체 보완은 진행하지 않음.
- **진행 메모**
  - 통합 테스트에서 용량 초과 422 응답이 유지되는지 재실행.
  - 프런트 `FridgeProvider#addBundle`에 허용량 초과 안내 문구를 추가해 사용자 메시지를 개선.
- **TODO**
  - 실제 등록 플로우 요구사항(폼 검증, 즉시 갱신)을 충족시키는 코드 변경 여부 확인.
  - 필요 시 추가 UI/서버 로직 보완 계획 마련.
