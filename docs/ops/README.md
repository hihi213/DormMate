# Ops 문서 포털
*용도: 운영·계획 관련 핵심 문서의 위치와 사용 원칙을 안내하는 인덱스로, 새 세션을 시작할 때 어떤 문서를 참고해야 하는지 정리한다.*

이 디렉터리는 프로젝트 전반에서 공통으로 참고해야 하는 운영/계획 문서를 모아 둡니다. 각 문서는 항상 최신 상태를 유지하고, 변경 시 다른 문서와의 싱크를 확인하세요.

## 주요 문서
- `docs/1.Feature_Inventory.md`: DormMate 기능·정책 카탈로그(무엇/왜)
- `docs/2.Demo_Scenario.md`: MVP 범위와 시연 흐름(어떻게)
- `docs/2.1.Demo_Plan.md`: 역할별 구현 단계와 체크리스트
- `docs/2.2.Status_Board.md`: 진행/테스트 로그
- `docs/data-model.md`: 데이터 모델 및 엔터티 관계 정리
- `docs/ops/security-checklist.md`: 보안 음성 흐름 API 호출 순서 및 로그 검증 가이드
- `docs/ops/batch-notifications.md`: 임박/만료 알림 배치 운영 지침
- `api/versions/v0.1.1.yml`: OpenAPI 버전 스냅샷(컨트롤러 변경 시 `/v3/api-docs`로 재생성 필요)
- `docs/ai-impl/README.md`: 프런트엔드·백엔드·Playground AI 협업 지침 인덱스

## AI 사용 지침
1. 새로운 세션을 시작할 때는 위 핵심 문서(MVP 시나리오·구현 계획·기능 정의)를 먼저 검토하고, 역할별 세부 지침은 `docs/ai-impl/README.md`에서 확인합니다.
2. 기능 정의/데이터/시나리오 문서는 항상 함께 갱신하고, 변경 이력은 PR/이슈, 팀 노트 등 프로젝트가 지정한 채널에 기록합니다.
3. 구현 AI, 학습용 AI, 사람이 모두 동일한 용어를 사용할 수 있도록 문서 간 용어를 일관되게 유지합니다.

## 자동화 CLI
- `tools/automation/cli.py`는 테스트, 빌드, 상태 관리를 위한 공통 진입점을 제공한다.
- 주요 명령
  - `./auto dev warmup [--refresh] [--with-playwright]`: Gradle/Node 의존성 예열(Playwright는 옵션)
  - `./auto dev up|down|status|backend|frontend --env <local|prod>`: Docker 및 개발 서버 제어
  - `./auto dev kill-ports [--ports …]`: 지정한 포트(기본 3000~3003, 8080)를 점유한 프로세스를 종료
  - `./auto tests core [--skip-backend --skip-frontend --skip-playwright --full-playwright]`: Step 6 테스트 번들
  - `./auto tests backend|frontend|playwright`: 계층별 테스트
- `./auto db migrate --env <local|prod>`, `./auto cleanup`, `./auto state show|update`
- 명령 전체 목록은 `./auto --help`로 확인한다.
- 기본값은 dev/db=`local`, deploy=`prod`이다.
- CLI는 `.codex/state.json`에 현재 프로필, 테스트 결과, 메모를 저장하므로 수동으로 수정하지 않는다.
- 세션 중 실행한 주요 명령과 결과는 PR/이슈 코멘트 또는 팀이 지정한 회고 문서에 요약해 다음 단계 준비를 원활히 한다.
- `/admin/seed/fridge-demo`는 데모 전용 API이므로 어떤 자동화 스크립트·CI에서도 호출하지 않는다. 필요 시 운영자가 직접 실행하고, 실행 전후 점검은 아래 "데모 데이터 초기화" 섹션을 따른다.
- OpenAPI 재생성: 백엔드 기동 후 `curl http://localhost:8080/v3/api-docs > api/openapi.yml`로 추출한 뒤 `api/versions/`에 버전을 올리고 `docs/2.1.Demo_Plan.md` 링크를 갱신한다.

### 로컬 실행(환경변수 파일 기준)
1. 샘플 복사  
   ```bash
   touch deploy/.env.local
   ```
   `deploy/.env.prod`는 키만 유지하고 값은 배포 직전에 채운다.
2. 기동  
   ```bash
  ./auto dev up --env local        # 전체 스택
  # 또는 ./auto dev backend --env local
   ```
  CORS 허용을 위해 `CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080` 등 필요한 오리진을 `deploy/.env.local`에 넣는다.
   JWT 기본값: access 45초(`jwt.expiration=45000`), refresh 5분(`jwt.refresh-expiration=300000`), 세션은 deviceId로 묶인다.

### Docker Compose로 실행(권장)
- 사람이 수동으로 `source`하지 않고 `--env-file` 또는 `--env`를 넘긴다.
  ```bash
  touch deploy/.env.local
  docker compose --env-file deploy/.env.local \
    -f docker-compose.yml -f docker-compose.prod.yml up -d
  ```
- CI/CD에서도 동일하게 `--env-file` 또는 환경변수 주입으로 처리한다.
  - 주요 포트: `PROXY_HTTP_PORT` 기본 8080(로컬)/80(운영), `PROXY_HTTPS_PORT` 기본 8443(로컬)/443(운영). DB/Redis는 prod 컴포즈에서 외부 포트 노출이 없다.
  - TLS: `ENABLE_TLS=true`, `SERVER_NAME`, `TLS_DOMAIN`, `TLS_EMAIL`, `TLS_SELF_SIGNED=false` 설정 후 한 번만 `./auto deploy tls issue --env prod --domain <도메인> --email <메일>`을 실행한다. 셀프사인(`TLS_SELF_SIGNED=true`)은 데모/로컬 전용.
  - 필수 보안 env: `JWT_SECRET`는 prod에서 반드시 지정(`application-prod.properties`는 미지정 시 실패), CORS 오리진(`CORS_ALLOWED_ORIGINS`), 관리자 계정/비밀번호.

## 데모 데이터 초기화 (수동·비운영 전용)

이 기능은 시연 중 쌓인 데이터를 정리하기 위한 임시 도구다. **운영 DB에서는 실행하지 않는다.**
물품·포장뿐 아니라 검사 조치·세션·일정·벌점·라벨 시퀀스도 삭제하고 데모 데이터를 재구성한다.

- 자동 Flyway 경로의 `R__demo_reset.sql`은 기존 적용 이력 식별자를 유지하며, 남아 있는
  `fn_demo_reset_fridge()` 함수만 제거한다. 업무 데이터는 변경하지 않는다.
- 초기화 함수 정의는 `backend/src/main/resources/db/demo/fridge_reset.sql`에 보관한다.
- `fridge_exhibition_items.sql`이 함수를 호출한다. 두 파일 모두 운영 자동 마이그레이션에서 제외된다.
- `prod` 프로필에서는 데모 API와 서비스가 등록되지 않는다.
- 비운영 관리자 API `POST /admin/seed/fridge-demo`는 함수 설치와 초기화·감사 기록을
  하나의 트랜잭션으로 실행한다. 자동화·예약 작업에는 넣지 않는다.

수동 실행이 필요하면 백업 후 대상이 폐기 가능한 데모 DB인지 확인하고, 저장소 루트에서
데모 DB 연결 전용 환경변수 `DEMO_DATABASE_URL`을 설정한 뒤 다음을 실행한다.

```bash
psql "$DEMO_DATABASE_URL" -X --set=ON_ERROR_STOP=1 --single-transaction \
  -f backend/src/main/resources/db/demo/fridge_reset.sql \
  -f backend/src/main/resources/db/demo/fridge_exhibition_items.sql
```

기존 DB 업그레이드 시 `flyway repair`나 이력 삭제는 필요하지 않다. 변경된 repeatable이
한 번 적용되어 기존 함수를 제거하며, 이후 변경이 없으면 재실행되지 않는다.
다른 과거 버전 마이그레이션에 포함된 데모 시드까지 정리한 것은 아니므로, 신규 운영 DB의
전체 초기화 경로 검증은 별도 배포 전제 조건으로 유지한다.

### 비상/경고 문구 표기 위치
- 본 섹션 외에도 `docs/2.Demo_Scenario.md §2 사전 준비` 및 `docs/2.2.Status_Board.md`에 동일 경고를 반복 노출한다.
- 운영 절차 문서, 배포 체크리스트, 페이지 데크 등에 “/admin/seed/fridge-demo는 데모 전용”이라는 문구를 추가하고, 자동화나 예약 작업에 포함시키지 않는다.

### 알림/배치 운영 메모
- 임박/만료 배치: 매일 09:00 `FridgeExpiryNotificationScheduler`가 실행되며, 결과는 `notification_dispatch_log`에 기록된다(채널 `INTERNAL_BATCH`).
- 검사 결과 알림 dedupe 키: `FRIDGE_RESULT:<sessionId>:<userId>`. 중복 제출 시 추가 발송되지 않는다.
- 사용자 알림 설정: `PATCH /notifications/preferences/{kindCode}`로 종류별 ON/OFF 및 `allowBackground`를 저장한다. 기본 정책/TTL/일일 한도는 `admin_policy`로 관리하며 별도 `notification_policy` 테이블은 미도입 상태.

## 운영 점검 루틴
- **검사 → 알림 연동**: `inspection_action`에서 `correlation_id`가 채워진 알림을 `notification`에서 확인하고, 거주자 알림을 통해 조치 상세로 이동하는 흐름을 주기적으로 리허설한다.
- **검사 정정 감사**: ADMIN 정정(PATCH `/fridge/inspections/{id}`) 실행 후 `penalty_history`와 `audit_log (INSPECTION_ADJUST)`가 기대대로 갱신됐는지 확인한다.
- **알림 설정 이력**: `notification_preference`의 `updated_at`을 기준으로 ON/OFF 변경 이력을 살펴보고, 동일 계정이 여러 기기에서 설정을 변경했을 때 즉시 일관되게 반영되는지 확인한다.
- **발송 실패 로그**: `notification_dispatch_log`에서 최근 알림 실패 건을 조회하고, `error_code`·`error_message`를 기반으로 재시도 또는 장애 전파가 가능한지 점검한다.
- **검사 조치 감사**: `inspection_action_item`의 스냅샷 데이터를 점검해 폐기·경고 근거가 남아 있는지 확인하고, `unregistered_item_event`가 누락되지 않았는지 주기적으로 모니터링한다.
- **DB 인덱스 점검**: Flyway `V18__add_fridge_search_indexes.sql`이 성공했는지 `pg_indexes`에서 `idx_room_assignment_user_released`, `idx_room_room_number_lower` 존재 여부를 확인하고, 관리자 검색이 느려질 경우 재적용 여부를 검토한다.

## 신규 운영 DB 초기화 (2026-10-08 이후)

- 신규 운영 기본 경로는 `db/production`이다. `V1`은 현재 스키마, `V2`는 역할·96개 호실·냉장고 시설 기준 데이터만 만든다.
- 계정·비밀번호·호실 입주 배정·물품·검사·벌점은 생성하지 않는다. 초기 관리자 발급과 실제 입주자 등록은 별도 운영 준비가 필요하다.
- Spring prod, Gradle Flyway 기본값과 prod Compose migrate 서비스는 이 경로를 사용한다.
- 이력이 없지만 테이블이 있는 DB는 자동 baseline 하지 않고 실패한다. 기존 `db/migration` 이력이 있는 DB도 새 경로로 전환하면 검증이 실패한다. `repair`, 이력 삭제 또는 자동 baseline으로 우회하지 않는다.
- 기존 DB 업그레이드는 백업 후 이력을 먼저 확인한다. 과거 시드가 아직 미적용이라면 계정 비밀번호 덮어쓰기가 가능하므로 원본 경로의 마이그레이션도 무조건 실행하지 않는다.
- 기존 경로를 검증 목적으로 선택할 때 Spring은 `FLYWAY_LOCATIONS=classpath:db/migration`, Gradle은 `FLYWAY_LOCATIONS=filesystem:src/main/resources/db/migration`을 사용한다. 이는 신규 운영 설정이 아니다.
- 향후 운영 스키마 변경은 `db/production/V3__...sql`부터 추가한다. 기존 `db/migration`은 과거 이력·데모 테스트 호환용으로 보존하며 두 경로를 한 DB에서 섞지 않는다.
- 신규 스키마는 V1/V4/V8~V13/V17~V20/V22/V24~V26/V33~V35/V38~V41의 구조 변경과 진단 뷰를 통합했다. 버전이 붙은 기존 파일의 checksum은 수정하지 않았다.

## 최초 관리자 발급

신규 운영 DB의 관리자 발급은 기본적으로 비활성화되어 있다. `db/production` 경로를 사용하는 DB에서만 다음 절차를 수행한다.

1. 운영 서버의 Git 저장소 밖에 소유자만 읽을 수 있는 비밀번호 파일(권한 `600`)을 준비한다. 비밀번호는 12자 이상, UTF-8 기준 72바이트 이하여야 한다. 파일 끝 공백/줄바꿈은 제거된다. 비밀번호를 명령 인수나 Git 파일에 넣지 않는다.
2. `deploy/.env.prod`에 아래 설정을 넣는다. `ADMIN_BOOTSTRAP_PASSWORD_SOURCE`는 해당 서버의 절대 경로다. 공백이 포함된 이름은 따옴표로 감싼다.

```dotenv
DORMMATE_BOOTSTRAP_LOGIN_ID=initial-admin
DORMMATE_BOOTSTRAP_NAME='System Administrator'
DORMMATE_BOOTSTRAP_EMAIL=admin@example.com
ADMIN_BOOTSTRAP_PASSWORD_SOURCE=/absolute/private/path/admin_password.txt
```

3. 저장소 루트에서 최초 발급용 설정을 추가해 기동한다.

```bash
docker compose --env-file deploy/.env.prod \
  -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.bootstrap.yml \
  up -d --build proxy
```

4. 발급 완료 로그와 실제 로그인을 확인한 뒤, 최초 발급 설정을 제외해 앱을 다시 만든다.

```bash
docker compose --env-file deploy/.env.prod \
  -f docker-compose.yml -f docker-compose.prod.yml \
  up -d --force-recreate app
```

5. 재기동과 로그인을 확인한 뒤 비밀번호 파일 및 부트스트랩 전용 환경값을 제거한다. 먼저 파일만 제거하고 발급용 설정으로 재시작하면 파일 읽기 오류로 기동이 실패한다.

발급 작업은 계정·ADMIN 역할·감사 로그·완료 표식을 하나의 트랜잭션으로 저장한다. 동시 기동은 DB 트랜잭션 잠금으로 직렬화한다. 완료 후 재호출하거나 기존 관리자 역할 이력이 있으면 계정을 변경하지 않는다. 기존 거주자와 대소문자를 무시한 아이디 충돌이 있으면 승격하지 않고 실패한다. 완료 표식을 지워 비밀번호 복구에 재사용하지 않는다.

운영 기동 검증은 `/healthz`(프로세스)와 `/readyz`(의존성 전체)를 구분한다. `/readyz`는 정상 시 200, 의존성 장애 또는 확인 실패 시 503을 반환한다. 운영 Compose의 Redis 연결은 `redis` 서비스로 지정한다. `JWT_SECRET`은 필수이며, Base64 키는 디코딩 후 32바이트 이상이어야 한다. 키 누락·길이 부족은 기동 실패로 처리한다.
