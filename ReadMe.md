# DormMate

DormMate는 기숙사 냉장고의 물품 관리와 층별 검사를 돕기 위한 Spring Boot 기반 백엔드와 Next.js 프론트엔드 프로젝트입니다. 백엔드 우선 MVP를 목표로 하며, 운영 환경을 로컬에서 빠르게 재현할 수 있도록 Docker Compose·Flyway·자동화 스크립트를 제공합니다.

> 바로가기(문서 지도): `docs/1.Feature_Inventory.md`(정책 SSOT), `docs/2.Demo_Scenario.md`(데모/범위), `docs/2.1.Demo_Plan.md`(체크리스트), `docs/2.2.Status_Board.md`(진행 로그), `docs/ops/README.md`(운영/배포), `docs/tests/admin-playwright-plan.md`(관리자 E2E), `docs/data-model.md`(엔터티).

## 현재 구현된 핵심 기능 스냅샷

- **거주자 냉장고 관리**
  - 배정된 칸만 조회/등록 가능, 라벨 자동 발급 및 삭제 시 재사용, 임박/만료 배지 및 검색(라벨·호실·사용자) 제공.
- **층별장 검사**
  - 세션 잠금/연장, 조치·벌점 기록, 제출 시 알림/감사 로그 발행. 제출 완료된 검사에 대해 ADMIN이 메모·조치를 정정(PATCH `/fridge/inspections/{id}`)하고 벌점/알림이 즉시 재계산된다.
- **관리자 포털**
  - `/admin/fridge`에서 칸 상태, 포장 CRUD, 검사 이력, 재배분, 데모 시드 실행을 통합 관리한다. 검사 정정은 서버 PATCH와 연동되어 있고, 알림 재발송은 버튼·토스트만 제공되며 재검 요청은 현재 UI에서 제거된 상태다.
- **알림/배치**
  - 사용자 알림 REST API(`GET /notifications`, `PATCH /notifications/{id}/read`, `GET/PATCH /notifications/preferences`)와 임박/만료 배치가 운영 중이며, 실패 로그는 `notification_dispatch_log`에 기록된다.
- **감사/시드**
  - 모든 관리자 액션(검사 제출·정정, 재배분, 데모 초기화 등)이 `audit_log`에 JSON 메타데이터로 기록된다. `/admin/seed/fridge-demo`는 전시용 포장/검사/벌점 데이터를 다시 삽입하므로 **운영 DB에서는 절대 실행하지 않는다.**

## 주요 스택 & 권장 버전

- **Backend**: Spring Boot 3.3.4, Java 21, Gradle 8.9, Flyway 10.17, PostgreSQL 16 (`backend/build.gradle`)
- **Frontend**: Next.js 15.5.6, React 18.2, TypeScript 5.6, Tailwind CSS 3.4 (`frontend/package.json`)
- **Infrastructure**: Docker Compose, Redis 7.2, pgAdmin 4 (8.6)
- **Tooling**: Node.js 22.11 (LTS), npm 10, 자동화 CLI(`./auto`, `.nvmrc` 기반)

세부 요구 사항 및 주의 사항은 프로젝트 루트의 `nogitReadME.md`(버전 관리 제외)에 최신 메모 형태로 정리되어 있습니다.

## 빠른 시작

```bash
# 개발용 DB/Redis 기동 (애플리케이션은 로컬에서 직접 실행, 필요 시 env.sample를 .env.local로 복사)
docker compose --env-file deploy/.env.local up -d db redis

# 운영과 동일한 전체 스택(prod 파일 포함) 기동
docker compose --env-file deploy/.env.prod -f docker-compose.yml -f docker-compose.prod.yml up -d proxy
# proxy 서비스만 명시하면 depends_on에 의해 app/frontend도 함께 기동됩니다.

# 동일 작업을 자동화 스크립트로 실행하려면:
./auto deploy up --build [--push] --env prod

# (DB 초기화 포함) 전체 스택을 재기동하려면:
./auto deploy reset --build [--push] --env prod

# 또는 자동화 스크립트 사용
./auto dev up --env local

# 스키마 마이그레이션 적용
./auto db migrate --env local

# (최초 1회) 의존성 사전 설치 (Playwright 필요 시 --with-playwright 추가)
./scripts/dev-warmup.sh

# 백엔드 애플리케이션 실행
./auto dev backend --env local  # 또는 cd backend && ./gradlew bootRun

# 프론트엔드 개발 서버 (API_BASE 필요 시 .env.local에서 지정)
cd frontend && npm install && npm run dev
```

> proxy 컨테이너는 기본적으로 호스트 8080/8443 포트를 사용합니다. 운영 서버에서는 `deploy/.env.prod`에서 `PROXY_HTTP_PORT=80`, `PROXY_HTTPS_PORT=443`으로 바꿔두면 됩니다.
>
> HTTPS를 활성화하려면 `ENABLE_TLS=true`, `SERVER_NAME=<도메인>`, `TLS_DOMAIN=<도메인>`, `TLS_EMAIL=<연락 이메일>`, `TLS_SELF_SIGNED=false`, `PROXY_HTTPS_PORT=443`을 지정한 뒤 한 번만 `./auto deploy tls issue --env prod --domain <도메인> --email <이메일>`을 실행해 인증서를 발급하세요. 이후에는 `./auto deploy tls renew --env prod`만 주기적으로 실행하면 됩니다(예: cron). 셀프사인(`TLS_SELF_SIGNED=true`)은 데모/로컬 전용입니다.
>
> 헬스체크는 `http://localhost:8080/healthz`(백엔드)와 `http://localhost:8080/frontend-healthz`(프런트) 두 엔드포인트로 분리 확인할 수 있습니다. proxy 컨테이너도 동일 경로를 그대로 노출합니다.

> DB 컨테이너는 5432 포트를 호스트에 노출합니다. 로컬 툴(IDE, psql)에서는 `localhost:5432`로 접속하고, 다른 컨테이너에서 접근할 때는 `db:5432` 호스트명을 사용하세요. 필요한 환경 변수 목록은 `backend/ENV_SETUP.md`를 참고해 `deploy/.env.prod`를 작성하세요.

> CI 런너(예: GitHub Actions)는 Java 21, Node.js 22, Docker(Compose), PostgreSQL 16, Redis 7.2 이미지를 사용할 수 있는 환경이어야 합니다. 기본 워크플로(`.github/workflows/ci.yml`)는 이러한 런타임을 기준으로 구성되어 있습니다.

Flyway 마이그레이션 파일은 `backend/src/main/resources/db/migration` 디렉터리를 참고하세요.

## 자동화 명령 요약
> 모든 명령은 `--env local|prod` 또는 `--env-file <path>`로 명시 실행하는 것을 표준으로 한다.
> 기본값: dev/db 명령은 `local`, deploy 명령은 `prod`.

- `./auto dev warmup [--refresh] [--with-playwright]`: Gradle/Node 의존성 사전 준비(Playwright 브라우저 설치는 `--with-playwright` 사용, `scripts/dev-warmup.sh`는 이 명령을 위임 실행)
- `./auto dev up --env local` / `./auto dev down --env local`: 개발용 Docker 서비스 기동·종료
- `./auto dev backend --env local` / `./auto dev frontend --env local`: Spring Boot · Next.js 개발 서버 실행
- `./auto dev kill-ports [--ports 3000 8080 …]`: 지정한 포트(미지정 시 3000~3003, 8080)를 점유한 프로세스를 정리
- `./auto tests core [--skip-backend --skip-frontend --skip-playwright --full-playwright]`: Step6 테스트 번들(Gradle은 오프라인 우선, 실패 시 의존성 갱신)
- `./auto tests backend|frontend|playwright`: 개별 계층 테스트(`backend`는 오프라인 → 리프레시 순으로 자동 시도, `frontend`는 `npm run lint` 실행)
- `./auto db migrate [--repair] --env <local|prod>`: Flyway 마이그레이션 / 필요 시 `flywayRepair`
- `./auto deploy up|down|status|reset --env <local|prod>`: 운영용 docker-compose(prod) 스택 제어 (프론트·프록시 포함)
- `./auto deploy tls issue|renew --env <local|prod>`: Let's Encrypt 인증서 발급/갱신 헬퍼(`certbot` webroot 방식)
- `./auto cleanup`: 빌드 산출물 정리
- `./auto state show` / `./auto state update --notes "..."`
  : Codex 상태 기록 및 Verify & Record 단계 메모 업데이트

> 원하는 경우 `alias auto='python3 tools/automation/cli.py'`를 셸 설정에 추가하면 `auto …`로 바로 실행할 수 있습니다.

`./auto` 자동화 CLI는 Java 21 런타임, 로컬 Gradle 캐시(`.gradle-cache`), Node 22 바이너리를 자동으로 PATH에 등록합니다. 셸 프로파일(`.bash_profile`, `.zshrc`)에서 Node·Java 경로가 기본값으로 설정되어 있으므로 추가 스크립트를 로드할 필요가 없습니다. Gradle을 직접 실행해야 할 때는 `cd backend && ./gradlew <task>` 형태로 호출하십시오.

### Playwright E2E 테스트 가이드

1. 최초 한 번 브라우저 바이너리를 설치합니다. `./auto dev warmup --with-playwright` 명령으로 함께 설치할 수 있습니다.
2. 로컬에서 스모크 테스트는 기본 `./auto tests core`로 실행됩니다.
   ```bash
   ./auto tests core
   ```
3. 확장 e2e를 돌리려면 `./auto tests core --full-playwright` 또는 `npm run playwright:test --prefix frontend`를 사용하세요. CI에서는 Playwright 브라우저를 설치한 뒤 동일 명령을 실행하며, 베이스 URL은 `PLAYWRIGHT_BASE_URL` 환경 변수로 덮어쓸 수 있습니다(기본값 `http://localhost:3000`).

> ❗️ 모든 Playwright 실행은 Next.js 앱이 기동된 상태를 전제로 합니다. `./auto dev up --env local` 또는 `npm run dev` 등으로 서비스가 준비됐는지 확인하세요.

## 배포 체크리스트 (MVP)

1. 프론트/백엔드 빌드  
   ```bash
   cd frontend && npm run build
   cd backend && ./gradlew bootJar
   ```
2. Docker 이미지 태깅  
   ```bash
   docker compose --env-file deploy/.env.prod -f docker-compose.yml -f docker-compose.prod.yml build app
   docker tag dorm_app:latest dormmate/app:<TAG>
```
3. 배포/업데이트  
   ```bash
   docker compose --env-file deploy/.env.prod -f docker-compose.yml -f docker-compose.prod.yml up -d proxy
   # proxy 기동 시 backend/frontend 컨테이너가 함께 올라갑니다.
  # 또는 ./auto deploy up --build --env prod
   ```
4. 실패 시 롤백  
   ```bash
   docker compose --env-file deploy/.env.prod -f docker-compose.yml -f docker-compose.prod.yml down
   docker compose --env-file deploy/.env.prod -f docker-compose.yml -f docker-compose.prod.yml build --no-cache app frontend
   docker compose --env-file deploy/.env.prod -f docker-compose.yml -f docker-compose.prod.yml up -d proxy --build  # 안정 버전으로 재배포
   ```

> 운영 배포 전에는 `./auto tests core --full-playwright` 결과를 확인하세요.

## 서버 배포 절차

1. **코드 동기화**
   ```bash
   cd ~/DormMate
   git fetch --all
   git checkout <배포 브랜치>   # main 혹은 develop
   git pull
   ```
2. **환경 변수 확인**
   - `deploy/.env.prod`는 키만 유지하고 값은 배포 직전에 채운다. `chmod 600 deploy/.env.prod`.
   - 비밀번호나 도메인이 변경됐다면 GitHub Secrets(`ENV_FILE_CONTENTS`)도 함께 갱신.
3. **데이터베이스 마이그레이션**
   ```bash
  ./auto db migrate --env prod                 # 실패 시 ./auto db migrate --repair --env prod 후 재실행
   ```
- DB 초기화가 필요하면 `./auto deploy reset --build --env prod`를 사용하면 된다.
4. **스택 재배포**
   ```bash
  ./auto deploy down --env prod                # 필요 시 --volumes 제거 가능
  ./auto deploy up --build --env prod          # 이미지 빌드 후 proxy(app/frontend) 기동
   ```
   - 이미지 push/pull이 필요하면 `--push`, `--pull` 옵션을 추가한다.
5. **검증**
   ```bash
  ./auto deploy status --env prod
   curl http://<서버IP>/healthz
   curl http://<서버IP>/frontend-healthz
   ```
   - 브라우저에서 `http://<서버IP>` 접속 후 로그인/주요 기능 확인.
6. **문제 발생 시 정리**
   ```bash
  ./auto deploy down --volumes --remove-orphans --env prod
   ```
   - 포트 충돌 시 `sudo systemctl stop nginx` 또는 `PROXY_HTTP_PORT` 변경.
   - 디스크 부족 시 `docker system prune -af`, `docker volume prune` 등으로 공간 확보 후 다시 실행.

> `./auto deploy up --build --env prod`를 기준 흐름으로 사용하면 로컬과 동일한 환경이 서버에도 재현된다.

## 추가 문서

- `backend/ENV_SETUP.md`: 환경 변수와 보안 체크리스트 (prod에서는 `JWT_SECRET` 필수)
- `api/openapi.yml`: OpenAPI seed 명세
- `tools/db/README.md`: 스키마 드리프트 감지 가이드 (CLI 연동 예정)
- `docs/presentation-outline.md`: 질문 대비용 전체 구현 개요(문제 정의, 아키텍처, 인프라/운영 상세)
- `docs/service/service-definition.md#6-테스트-및-완료-기준`: Step 6 테스트 번들·로그 기록 지침

운영/배포 절차, 검증 체크리스트 등은 이후 문서화를 진행하면서 `docs/` 이하에 보강할 예정입니다.
