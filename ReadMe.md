# DormMate

DormMate는 기숙사 냉장고의 물품 관리와 층별 검사를 돕기 위한 Spring Boot 기반 백엔드와 Next.js 프론트엔드 프로젝트입니다. 이 저장소는 백엔드 우선 MVP를 목표로 하며, 운영 환경과 개발 환경을 빠르게 재현할 수 있도록 Makefile·Docker Compose·Flyway를 이용한 통합 개발 경험을 제공합니다.

## 주요 스택 & 권장 버전

- **Backend**: Spring Boot 3.3.4, Java 21, Gradle 8.9, Flyway 10.17, PostgreSQL 16
- **Frontend**: Next.js 14.2.7, React 18.2, TypeScript 5.4, Tailwind CSS 3.4
- **Infrastructure**: Docker Compose, Redis 7.2, pgAdmin 4 (8.6)
- **Tooling**: Node.js 20 LTS, npm 10, Makefile 명령 모음

세부 요구 사항 및 주의 사항은 프로젝트 루트의 `nogitReadME.md`(버전 관리 제외)에 최신 메모 형태로 정리되어 있습니다.

## 빠른 시작

```bash
# 필수 환경 변수 템플릿 확인
cp .env.example .env

# 백엔드/DB 인프라 기동
docker compose up -d

# 또는 Makefile 활용
make up           # db, redis, pgAdmin
make migrate      # Flyway 마이그레이션 적용
make seed         # 기본 데이터 시드

# 백엔드 애플리케이션 실행
cd backend && ./gradlew bootRun

# 프론트엔드 개발 서버
cd client && npm install && npm run dev
```

> DB 컨테이너는 5432 포트를 호스트에 노출합니다. 로컬 툴(IDE, psql)에서는 `localhost:5432`로 접속하고, 다른 컨테이너에서 접근할 때는 `db:5432` 호스트명을 사용하세요.

> CI 런너(예: GitHub Actions)는 Java 21, Node.js 20, Docker(Compose), PostgreSQL 16, Redis 7.2 이미지를 사용할 수 있는 환경이어야 합니다. 기본 워크플로(`.github/workflows/ci.yml`)는 이러한 런타임을 기준으로 구성되어 있습니다.

Flyway 마이그레이션 파일은 `backend/src/main/resources/db/migration`에 `V1__init.sql`, `R__Seed.sql` 두 개만 유지합니다. 기존 버전 아카이브는 `docs/legacy/` 하위로 이동했습니다.

## Makefile 주요 명령

- `make up` / `make down`: 로컬 인프라 컨테이너 기동·종료
- `make migrate`: Flyway 기반 스키마 마이그레이션
- `make seed`: 기본 시드 데이터 적용
- `make backend-build` / `make backend-test`: Gradle 빌드 및 테스트
- `make client-dev` / `make client-build`: 프론트엔드 개발 서버 및 프로덕션 빌드
- `make client-lint`: 프론트엔드 ESLint 검사 (로컬에 Node.js가 없으면 자동으로 Docker `node:20-alpine` 이미지를 사용해 실행)
- `make tests-core`: Spectral + 백엔드 + 프론트 테스트 일괄 실행 (Step 6 권장)
- `make playwright-install` / `make playwright-test`: Playwright 설치 및 E2E 테스트 실행 (선택)

자세한 옵션은 `make help`를 확인하세요.

### Playwright E2E 테스트 가이드

1. 최초 한 번 브라우저 바이너리를 설치합니다.
   ```bash
   make playwright-install
   # 또는 cd client && npm run playwright:install
   ```
2. 로컬에서 스모크 테스트를 실행하려면 `PLAYWRIGHT=1` 플래그를 켜고 통합 테스트 번들을 호출합니다.
   ```bash
   PLAYWRIGHT=1 make tests-core
   # 또는 cd client && npm run playwright:test
   ```
3. CI에서는 `CI=true`가 자동으로 전달되어 Playwright가 포함되며, 베이스 URL은 `PLAYWRIGHT_BASE_URL` 환경 변수로 덮어쓸 수 있습니다(기본값 `http://localhost:3000`).

> ❗️ 모든 Playwright 실행은 Next.js 앱이 기동된 상태를 전제로 합니다. `docker compose up` 또는 `npm run dev` 등으로 서비스가 준비됐는지 확인하세요.

## 추가 문서

- `backend/ENV_SETUP.md`: 환경 변수와 보안 체크리스트
- `docs/legacy/`: 과거 버전 문서 및 백업 자료
- `api/openapi.yml`: OpenAPI seed 명세

운영/배포 절차, 검증 체크리스트 등은 이후 문서화를 진행하면서 `docs/` 이하에 보강할 예정입니다.
