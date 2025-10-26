#!/usr/bin/env bash
# Backward-compatible entrypoint: delegate to the unified automation CLI.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

exec "$PROJECT_ROOT/auto" dev warmup "$@"
