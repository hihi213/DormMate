.PHONY: help up down ps logs db-up migrate schema seed reset-db client-dev client-build client-lint backend-build backend-test backend-clean db-shell pgadmin-url redis-cli clean dev dev-front migrate-local schema-drift

# =============================================================
# DormMate — 통합 개발/운영 Makefile
# - docker-compose(db/redis/pgadmin/flyway) 제어
# - DB 마이그레이션/시드/리셋
# - 백엔드(Gradle) / 프론트(Next.js) 작업 단일화
# - 기존 scripts/*, tools/db/* 스크립트는 본 Makefile로 대체됨
# 사용법: `make help`
# =============================================================

# 기본 설정
#  - DB_CONTAINER/DB_NAME/DB_USER는 docker-compose.yml의 값과 일치해야 함
#  - zsh 쉘 사용(맥OS 기본) — bash 사용 시 SHELL 경로를 바꾸세요
SHELL := /bin/zsh
PROJECT_ROOT := $(PWD)
DB_CONTAINER := dorm_postgres
DB_NAME := dormitory_db
DB_USER := dorm_user

help:
	@echo "사용 가능한 타깃:"
	@echo "  up           - 필수 도커 서비스(db, redis, pgadmin) 기동 (개발용)"
	@echo "  up-prod      - 운영용 도커 서비스(db, redis, app) 기동 (포트 노출 없음)"
	@echo "  down         - 모든 도커 서비스 중지/정리 (개발용)"
	@echo "  down-prod    - 운영용 도커 서비스 중지/정리"
	@echo "  ps           - 도커 서비스 상태"
	@echo "  logs         - 데이터베이스 로그 팔로우"
	@echo "  db-up        - DB(건강 체크 포함)만 기동"
	@echo "  migrate      - Flyway 마이그레이션 실행(backend/src/main/resources/db/migration)"
	@echo "  schema       - migrate 별칭"
	@echo "  seed         - 기본 시드 실행(R__Seed.sql)"
	@echo "  reset-db     - DB 초기화(데이터 삭제) → 스키마 → 데모 시드"
	@echo "  db-shell     - psql 셸 접속"
	@echo "  pgadmin-url  - pgAdmin 접속 URL 힌트 출력"
	@echo "  client-dev   - 프론트 개발 서버(Next.js)"
	@echo "  client-build - 프론트 빌드"
	@echo "  client-lint  - 프론트 ESLint"
	@echo "  backend-build- 백엔드 Gradle 빌드"
	@echo "  backend-test - 백엔드 테스트"
	@echo "  backend-clean- 백엔드 클린"
	@echo "  clean        - 캐시/빌드 산출물 정리"
	@echo "  dev          - 도커 기동 후 백엔드(Spring Boot) 실행"
	@echo "  dev-front    - dev + 프론트(Next.js) 병행 실행"
	@echo "  migrate-local- V1__init → R__Seed 순차 적용(psql)"
	@echo "  schema-drift  - migra 사용해 actual↔expected 스키마 드리프트 점검"
	@echo "  api-docs      - Swagger UI 열기 (로컬 개발용)"
	@echo "  api-diff      - Seed vs Runtime OpenAPI diff 체크"
	@echo "  api-export    - Runtime OpenAPI 명세 덤프"
	@echo "  api-compat    - API 버전 간 호환성 체크"

# --- Docker Compose 관리 ---
# 인프라 기동/중지/상태/로그
up:
	docker compose up -d db redis pgadmin
up-prod:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d db redis app

down:
	docker compose down -v
down-prod:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml down -v

ps:
	docker compose ps

logs:
	docker logs -f $(DB_CONTAINER)

db-up:
	docker compose up -d db
	@echo "DB 건강 체크 대기 중..."
	docker compose run --rm migrate -community -q info >/dev/null 2>&1 || true

# --- DB 마이그레이션/시드 ---
# migrate: flyway 컨테이너로 backend/src/main/resources/db/migration/*.sql 적용
# seed: psql로 로컬 SQL을 컨테이너에 stdin 전달
migrate:
	# docker-compose의 flyway 컨테이너 사용
	docker compose run --rm migrate

schema: migrate

seed:
	# 기본 시드 스크립트를 DB에 적용 (로컬 파일을 stdin으로 전달)
	cat backend/src/main/resources/db/migration/R__Seed.sql | docker exec -i $(DB_CONTAINER) psql -U $(DB_USER) -d $(DB_NAME) -v ON_ERROR_STOP=1

reset-db:
	# 주의: 로컬 DB 볼륨(db_data/) 내용을 삭제합니다. 되돌릴 수 없습니다.
	@read "?정말로 로컬 DB 데이터를 삭제하고 재설정할까요? (yes/NO): " ans; \
	if [ "$$ans" = "yes" ]; then \
		docker compose down -v; \
		rm -rf db_data/*; \
		docker compose up -d db; \
		echo "DB 건강 체크 대기 중..."; \
		sleep 5; \
		$(MAKE) migrate; \
		$(MAKE) seed; \
		echo "DB 리셋 완료"; \
	else \
		echo "취소됨"; \
	fi

db-shell:
	docker exec -it $(DB_CONTAINER) psql -U $(DB_USER) -d $(DB_NAME)

pgadmin-url:
	@echo "pgAdmin: http://localhost:5050 (기본 이메일: $$PGADMIN_EMAIL 또는 admin@example.com)"

# --- 프론트엔드 ---
# client-dev: Next.js 개발 서버
# client-build: 프로덕션 빌드
# client-lint: ESLint 검사
client-dev:
	cd client && npm run dev

client-build:
	cd client && npm run build

client-lint:
	cd client && npm run lint

# --- 백엔드(Gradle) ---
# build/test/clean 기본 작업. bootRun은 dev/ dev-front에서 사용
backend-build:
	cd backend && ./gradlew build -x test

backend-test:
	cd backend && ./gradlew test

backend-clean:
	cd backend && ./gradlew clean

# --- 보조 ---
# redis-cli: 컨테이너 내부 Redis CLI 접속
redis-cli:
	docker exec -it dorm_redis redis-cli

clean:
	rm -rf backend/build client/.next client/out client/dist artifacts/*.log artifacts/*.sql || true

# --- 개발 편의(스크립트 대체) ---
# dev: 도커 인프라 전체 기동 후 백엔드 애플리케이션 실행
# dev-front: dev + Next.js 프론트 개발 서버를 백그라운드로 함께 실행
dev:
	docker compose up -d
	cd backend && ./gradlew bootRun

dev-front:
	docker compose up -d
	( cd client && npm run dev ) &
	cd backend && ./gradlew bootRun

migrate-local:
	# 로컬에서 flyway 없이 psql로 순차 적용이 필요할 때 사용
	@echo "[migrate-local] V1__init.sql 적용"
	cat backend/src/main/resources/db/migration/V1__init.sql | docker exec -i $(DB_CONTAINER) psql -U $(DB_USER) -d $(DB_NAME) -v ON_ERROR_STOP=1
	@echo "[migrate-local] R__Seed.sql 적용"
	$(MAKE) seed

schema-drift:
	# tools/db/migra-local.sh를 호출하여 스키마 드리프트를 점검합니다.
	# 필요 환경변수: ACT_URL, ACT_HOST, ACT_PORT, ACT_DB, ACT_USER, ACT_PASSWORD
	bash tools/db/migra-local.sh

# --- OpenAPI 관리 ---
# Swagger UI 열기 (로컬 개발용)
api-docs:
	@echo "📖 Swagger UI를 열고 있습니다..."
	@open http://localhost:8080/swagger-ui/index.html

# Runtime OpenAPI 명세 덤프 (CI와 동일한 방식)
api-export:
	@echo "📤 Runtime OpenAPI 명세를 덤프하고 있습니다..."
	@mkdir -p build
	@curl -fsSL http://localhost:8080/v3/api-docs > build/openapi.generated.json
	@echo "✅ Runtime OpenAPI 명세가 build/openapi.generated.json에 저장되었습니다"

# Seed vs Runtime OpenAPI diff 체크 (설계 우선 강제)
api-diff:
	@echo "🔍 OpenAPI diff 체크를 진행하고 있습니다..."
	@bash scripts/export-openapi.sh
	@bash scripts/diff-openapi.sh

# API 버전 간 호환성 체크 (하위 호환성 유지)
api-compat:
	@echo "🔍 API 호환성 체크를 진행하고 있습니다..."
	@bash scripts/check-api-compatibility.sh
