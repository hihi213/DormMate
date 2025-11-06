#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$BACKEND_DIR/.." && pwd)"

DEFAULT_ENV_FILE="$PROJECT_ROOT/deploy/.env.prod"

ENV_FILE="$DEFAULT_ENV_FILE"
if [[ $# -gt 0 ]]; then
  CANDIDATE="$1"
  if [[ -f "$CANDIDATE" ]]; then
    ENV_FILE="$(cd "$(dirname "$CANDIDATE")" && pwd)/$(basename "$CANDIDATE")"
    shift
  fi
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[flyway] Environment file not found: $ENV_FILE" >&2
  exit 1
fi

echo "[flyway] Loading environment from $ENV_FILE"

(
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
  cd "$BACKEND_DIR"
  ./gradlew flywayMigrate "$@"
)
