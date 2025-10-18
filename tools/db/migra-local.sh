#!/usr/bin/env bash
set -euo pipefail

# ===========================================
# tools/db/migra-local.sh
# - 레포 마이그레이션 → expected DB(로컬 컨테이너)
# - 실제 DB에 flyway validate (정합성 체크)
# - migra(actual → expected)로 스키마 드리프트 SQL 생성
# - 결과: artifacts/migra.sql
# ===========================================

# ----- 필수: 실제 DB 접속 URL (libpq 형식) -----
# 예) export ACT_URL='postgresql://user:pass@host:5432/dbname'
: "${ACT_URL:?Set ACT_URL, e.g. export ACT_URL='postgresql://dorm_user:dorm_password@localhost:5432/dormitory_db'}"

# ----- 선택: migra 옵션 -----
# 비교할 스키마 (빈 값이면 전체). 보통 public.
: "${MIGRA_SCHEMA:=public}"
# 권한/GRANT 비교 포함 여부 (true/false)
: "${MIGRA_WITH_PRIVILEGES:=false}"
# DROP 등 파괴적 변경 포함 여부 (true/false)
: "${MIGRA_UNSAFE:=false}"

# ----- expected DB(로컬 컨테이너) 설정 -----
PG_IMAGE="postgres:16.4-alpine"
EXP_HOST="localhost"
EXP_PORT="5433"
EXP_DB="dormitory_expected"
EXP_USER="dorm_user"
EXP_PASS="dorm_password"

echo ">>> Starting expected Postgres (${PG_IMAGE}) on ${EXP_HOST}:${EXP_PORT} ..."
docker rm -f dormitory_expected >/dev/null 2>&1 || true
docker run -d --name dormitory_expected \
  -e POSTGRES_USER="${EXP_USER}" -e POSTGRES_PASSWORD="${EXP_PASS}" -e POSTGRES_DB="${EXP_DB}" \
  -p "${EXP_PORT}:5432" "${PG_IMAGE}" >/dev/null

# 헬스체크 대기
echo ">>> Waiting for expected DB to be ready..."
for i in {1..40}; do
  if PGPASSWORD="${EXP_PASS}" psql -h "${EXP_HOST}" -p "${EXP_PORT}" -U "${EXP_USER}" -d "${EXP_DB}" -c "select 1" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

FLYWAY_VERSION="10.17.0"
FLYWAY_ROOT="${HOME}/.cache/flyway"
FLYWAY_HOME="${FLYWAY_ROOT}/flyway-${FLYWAY_VERSION}"
FLYWAY_BIN="${FLYWAY_HOME}/flyway"

# ----- Flyway 설치 (없으면) -----
if [ ! -x "${FLYWAY_BIN}" ]; then
  echo ">>> Installing Flyway CLI ${FLYWAY_VERSION} ..."
  mkdir -p "${FLYWAY_ROOT}"
  curl -fsSL "https://repo1.maven.org/maven2/org/flywaydb/flyway-commandline/${FLYWAY_VERSION}/flyway-commandline-${FLYWAY_VERSION}-linux-x64.tar.gz" -o /tmp/flyway.tar.gz
  tar -xzf /tmp/flyway.tar.gz -C "${FLYWAY_ROOT}"
  rm -f /tmp/flyway.tar.gz
fi

chmod +x "${FLYWAY_BIN}"

# ----- 레포 마이그레이션 → expected DB 적용 -----
echo ">>> Applying migrations to expected DB ..."
"${FLYWAY_BIN}" \
  -url="jdbc:postgresql://${EXP_HOST}:${EXP_PORT}/${EXP_DB}" \
  -user="${EXP_USER}" \
  -password="${EXP_PASS}" \
  -locations=filesystem:backend/src/main/resources/db/migration \
  migrate

# ----- 실제 DB의 마이그 상태 validate -----
#  - JDBC URL로 바꿔야 하므로, ACT_URL을 구성했던 파츠를 그대로 한번 더 입력해 주세요.
#  - 자주 쓰는 환경 변수화 예:
#    ACT_HOST, ACT_PORT, ACT_DB, ACT_USER, ACT_PASSWORD 를 export 해두고 아래에서 참조
: "${ACT_HOST:?Set ACT_HOST (e.g. export ACT_HOST=localhost)}"
: "${ACT_PORT:=5432}"
: "${ACT_DB:?Set ACT_DB (e.g. export ACT_DB=dormitory_db)}"
: "${ACT_USER:?Set ACT_USER (e.g. export ACT_USER=dorm_user)}"
: "${ACT_PASSWORD:?Set ACT_PASSWORD (e.g. export ACT_PASSWORD=dorm_password)}"

echo ">>> Flyway validate on ACTUAL DB ..."
"${FLYWAY_BIN}" \
  -url="jdbc:postgresql://${ACT_HOST}:${ACT_PORT}/${ACT_DB}" \
  -user="${ACT_USER}" \
  -password="${ACT_PASSWORD}" \
  -locations=filesystem:backend/src/main/resources/db/migration \
  validate

# ----- Python + migra 설치 (없으면) -----
if ! python3 -c "import migra" >/dev/null 2>&1; then
  echo ">>> Installing migra ..."
  python3 -m pip install --user migra psycopg2-binary
  export PATH="$HOME/.local/bin:$PATH"
fi

# ----- migra 실행 (actual → expected) -----
mkdir -p artifacts
EXP_URL="postgresql://${EXP_USER}:${EXP_PASS}@${EXP_HOST}:${EXP_PORT}/${EXP_DB}"

MIGRA_FLAGS=""
if [ -n "${MIGRA_SCHEMA}" ]; then
  MIGRA_FLAGS="$MIGRA_FLAGS --schema=${MIGRA_SCHEMA}"
fi
if [ "${MIGRA_WITH_PRIVILEGES}" = "true" ]; then
  MIGRA_FLAGS="$MIGRA_FLAGS --with-privileges"
fi
if [ "${MIGRA_UNSAFE}" = "true" ]; then
  MIGRA_FLAGS="$MIGRA_FLAGS --unsafe"
fi

echo ">>> Running migra (actual → expected) ..."
echo ">>> migra flags: ${MIGRA_FLAGS}"
migra ${MIGRA_FLAGS} "$ACT_URL" "$EXP_URL" > artifacts/migra.sql || true

echo ">>> migra output (first 200 lines):"
sed -n '1,200p' artifacts/migra.sql || true

if [ -s artifacts/migra.sql ]; then
  echo "❌ Schema drift detected. See artifacts/migra.sql"
  exit 1
else
  echo "✅ No drift."
fi

# 컨테이너를 남기고 싶지 않으면 아래 주석 해제
# docker rm -f dormitory_expected >/dev/null 2>&1 || true
