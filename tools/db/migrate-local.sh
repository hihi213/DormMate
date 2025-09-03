#!/bin/bash

# 로컬 DB 마이그레이션 실행 스크립트
# 실행 순서: V000__baseline.sql → R_seed.sql → R_seed_demo.sql

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION_DIR="$PROJECT_ROOT/backend/src/main/resources/db/migration"

echo "🚀 DormMate 로컬 DB 마이그레이션 시작..."

# Docker Compose 상태 확인
if ! docker compose ps db | grep -q "Up"; then
    echo "❌ PostgreSQL이 실행되지 않았습니다. 먼저 'docker compose up -d db'를 실행하세요."
    exit 1
fi

# 마이그레이션 파일 존재 확인
if [ ! -f "$MIGRATION_DIR/V000__baseline.sql" ]; then
    echo "❌ V000__baseline.sql을 찾을 수 없습니다: $MIGRATION_DIR"
    exit 1
fi

echo "📁 마이그레이션 파일 위치: $MIGRATION_DIR"

# 1. 스키마 생성 (V000__baseline.sql)
echo "🔧 Step 1: 스키마 생성 (V000__baseline.sql)..."
docker exec -i dorm_postgres psql -U dorm_user -d dormitory_db < "$MIGRATION_DIR/V000__baseline.sql"

# 2. 기본 시드 데이터 (R_seed.sql)
echo "🌱 Step 2: 기본 시드 데이터 (R_seed.sql)..."
docker exec -i dorm_postgres psql -U dorm_user -d dormitory_db < "$MIGRATION_DIR/R_seed.sql"

# 3. 데모 데이터 (R_seed_demo.sql)
echo "🎭 Step 3: 데모 데이터 (R_seed_demo.sql)..."
docker exec -i dorm_postgres psql -U dorm_user -d dormitory_db < "$MIGRATION_DIR/R_seed_demo.sql"

echo "✅ 마이그레이션 완료!"
echo ""
echo "📊 확인 방법:"
echo "  docker exec -it dorm_postgres psql -U dorm_user -d dormitory_db"
echo "  \\dt  -- 테이블 목록"
echo "  SELECT * FROM resources;  -- 리소스 확인"
echo "  SELECT * FROM users;      -- 사용자 확인"
echo ""
echo "🔑 기본 계정 (비밀번호는 환경변수로 설정 필요):"
echo "  - admin: admin@example.local (ADMIN 역할)"
echo "  - 2F 층별장: floorlead_2f@example.local (INSPECTOR 역할)"
echo "  - 데모 입주자: 201-1@demo.local, 201-2@demo.local (USER 역할)"
