# DormMate

DormMate는 기숙사 냉장고의 물품 관리와 층별 검사를 돕기 위한 Spring Boot 기반 백엔드와 Next.js 프론트엔드 프로젝트입니다. 이 저장소는 백엔드 우선 MVP를 목표로 하며, 운영 환경과 개발 환경을 빠르게 재현할 수 있도록 Makefile·Docker Compose·Flyway를 이용한 통합 개발 경험을 제공합니다.

## 주요 스택 & 권장 버전

- **Backend**: Spring Boot 3.3.4, Java 21, Gradle 8.9, Flyway 10.17, PostgreSQL 16
- **Frontend**: Next.js 14.2.7, React 18.2, TypeScript 5.4, Tailwind CSS 3.4
- **Infrastructure**: Docker Compose, Redis 7.2, pgAdmin 4 (8.6)
- **Tooling**: Node.js 20 LTS, npm 10, 자동화 CLI(`./auto`)

세부 요구 사항 및 주의 사항은 프로젝트 루트의 `nogitReadME.md`(버전 관리 제외)에 최신 메모 형태로 정리되어 있습니다.

## 빠른 시작

```bash
# 필수 환경 변수 템플릿 확인
cp .env.example .env

# 개발용 인프라 기동 (Docker Compose)
docker compose up -d
# 또는 자동화 스크립트 사용
./auto dev up

# 스키마 마이그레이션 적용
./auto db migrate

# (최초 1회) 의존성/브라우저 사전 설치
./scripts/dev-warmup.sh

# 백엔드 애플리케이션 실행
./auto dev backend  # 또는 cd backend && ./gradlew bootRun

# 프론트엔드 개발 서버
cd frontend && npm install && npm run dev
```

> DB 컨테이너는 5432 포트를 호스트에 노출합니다. 로컬 툴(IDE, psql)에서는 `localhost:5432`로 접속하고, 다른 컨테이너에서 접근할 때는 `db:5432` 호스트명을 사용하세요.

> CI 런너(예: GitHub Actions)는 Java 21, Node.js 20, Docker(Compose), PostgreSQL 16, Redis 7.2 이미지를 사용할 수 있는 환경이어야 합니다. 기본 워크플로(`.github/workflows/ci.yml`)는 이러한 런타임을 기준으로 구성되어 있습니다.

Flyway 마이그레이션 파일은 `backend/src/main/resources/db/migration` 디렉터리를 참고하세요.

## 자동화 명령 요약

- `./auto dev warmup [--refresh]`: Gradle/Node/Playwright 캐시 사전 준비(최초 1회 권장, 기존 `scripts/dev-warmup.sh`는 이 명령을 위임 실행)
- `./auto dev up` / `./auto dev down`: 개발용 Docker 서비스 기동·종료
- `./auto dev backend` / `./auto dev frontend`: Spring Boot · Next.js 개발 서버 실행
- `./auto dev kill-ports [--ports 3000 8080 …]`: 지정한 포트(미지정 시 3000~3003, 8080)를 점유한 프로세스를 정리
- `./auto tests core [--skip-backend --skip-frontend --skip-playwright --full-playwright]`: Step6 테스트 번들(Gradle은 오프라인 우선, 실패 시 의존성 갱신)
- `./auto tests backend|frontend|playwright`: 개별 계층 테스트(`backend`는 오프라인 → 리프레시 순으로 자동 시도)
- `./auto db migrate`: Flyway 마이그레이션 적용
- `./auto cleanup`: 빌드 산출물 정리
- `./auto state show` / `./auto state update --notes "..."`
  : Codex 상태 기록 및 Verify & Record 단계 메모 업데이트

> 원하는 경우 `alias auto='python3 tools/automation/cli.py'`를 셸 설정에 추가하면 `auto …`로 바로 실행할 수 있습니다.

`./auto` 자동화 CLI는 Java 21 런타임, 로컬 Gradle 캐시(`.gradle-cache`), Corepack(Node 20) 바이너리를 자동으로 PATH에 등록합니다. 셸 프로파일(`.bash_profile`, `.zshrc`)에서 Node·Java 경로가 기본값으로 설정되어 있으므로 추가 스크립트를 로드할 필요가 없습니다. Gradle을 직접 실행해야 할 때는 `cd backend && ./gradlew <task>` 형태로 호출하십시오.

### Playwright E2E 테스트 가이드

1. 최초 한 번 브라우저 바이너리를 설치합니다. `./auto dev warmup` 명령은 이 단계까지 한 번에 처리합니다.
2. 로컬에서 스모크 테스트는 기본 `./auto tests core`로 실행됩니다.
   ```bash
   ./auto tests core
   ```
3. 확장 e2e를 돌리려면 `./auto tests core --full-playwright` 또는 `npm run playwright:test --prefix frontend`를 사용하세요. CI에서는 Playwright 브라우저를 설치한 뒤 동일 명령을 실행하며, 베이스 URL은 `PLAYWRIGHT_BASE_URL` 환경 변수로 덮어쓸 수 있습니다(기본값 `http://localhost:3000`).

> ❗️ 모든 Playwright 실행은 Next.js 앱이 기동된 상태를 전제로 합니다. `docker compose up` 또는 `npm run dev` 등으로 서비스가 준비됐는지 확인하세요.

## 배포 체크리스트 (MVP)

1. 프론트/백엔드 빌드  
   ```bash
   cd frontend && npm run build
   cd backend && ./gradlew bootJar
   ```
2. Docker 이미지 태깅  
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml build app
   docker tag dorm_app:latest dormmate/app:<TAG>
   ```
3. 배포/업데이트  
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d db redis app
   ```
4. 실패 시 롤백  
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml down
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d db redis app --build --no-cache  # 안정 버전으로 재배포
   ```

> 운영 배포 전에는 `./auto tests core --full-playwright` 결과를 확인하세요.

## 추가 문서

- `backend/ENV_SETUP.md`: 환경 변수와 보안 체크리스트
- `api/openapi.yml`: OpenAPI seed 명세
- `tools/db/README.md`: 스키마 드리프트 감지 가이드 (CLI 연동 예정)
- `docs/service/service-definition.md#6-테스트-및-완료-기준`: Step 6 테스트 번들·로그 기록 지침

운영/배포 절차, 검증 체크리스트 등은 이후 문서화를 진행하면서 `docs/` 이하에 보강할 예정입니다.
