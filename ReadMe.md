# DormMate

DormMate는 기숙사 냉장고의 물품 관리와 층별 검사를 돕기 위한 Spring Boot 기반 백엔드와 Next.js 프론트엔드 프로젝트입니다. 이 저장소는 백엔드 우선 MVP를 목표로 하며, 운영 환경과 개발 환경을 빠르게 재현할 수 있도록 Makefile·Docker Compose·Flyway를 이용한 통합 개발 경험을 제공합니다.

## 주요 스택 & 권장 버전

- **Backend**: Spring Boot 3.3.4, Java 21, Gradle 8.9, Flyway 10.17, PostgreSQL 16
- **Frontend**: Next.js 14.2.7, React 18.2, TypeScript 5.4, Tailwind CSS 4 Preview
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

Flyway 마이그레이션 파일은 `backend/src/main/resources/db/migration`에 `V1__init.sql`, `R__Seed.sql` 두 개만 유지합니다. 기존 버전 아카이브는 `docs/legacy/` 하위로 이동했습니다.

## Makefile 주요 명령

- `make up` / `make down`: 로컬 인프라 컨테이너 기동·종료
- `make migrate`: Flyway 기반 스키마 마이그레이션
- `make seed`: 기본 시드 데이터 적용
- `make backend-build` / `make backend-test`: Gradle 빌드 및 테스트
- `make client-dev` / `make client-build`: 프론트엔드 개발 서버 및 프로덕션 빌드
- `make client-lint`: 프론트엔드 ESLint 검사 (로컬에 Node.js가 없으면 자동으로 Docker `node:20-alpine` 이미지를 사용해 실행)

자세한 옵션은 `make help`를 확인하세요.

## 추가 문서

- `backend/ENV_SETUP.md`: 환경 변수와 보안 체크리스트
- `docs/legacy/`: 과거 버전 문서 및 백업 자료
- `api/openapi.yml`: OpenAPI seed 명세

운영/배포 절차, 검증 체크리스트 등은 이후 문서화를 진행하면서 `docs/` 이하에 보강할 예정입니다.
