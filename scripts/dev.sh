#!/usr/bin/env bash
set -euo pipefail

#DB: docker compose up -d
#서버: cd backend && ./gradlew bootRun
#프론트(옵션): cd client && npm run dev (별도 터미널)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

WITH_FRONTEND=false
if [[ ${1:-} == "--with-frontend" ]]; then
  WITH_FRONTEND=true
fi

cd "$ROOT_DIR"

echo "[dev] Bringing up Docker infra (db/redis/pgadmin/flyway)..."
docker compose up -d

cleanup() {
  echo "\n[dev] Caught exit. Leaving Docker containers running (db/redis/pgadmin)."
  echo "[dev] To stop infra: docker compose down"
}
trap cleanup EXIT INT TERM

if $WITH_FRONTEND; then
  echo "[dev] Starting frontend (Vite) in background..."
  (
    cd client
    npm run dev
  ) &
  FRONTEND_PID=$!
  echo "[dev] Frontend PID: $FRONTEND_PID (press Ctrl+C to stop session)"
fi

echo "[dev] Starting backend (Spring Boot)..."
cd "$ROOT_DIR/backend"
./gradlew bootRun


