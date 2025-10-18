#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TASK_DIR="$ROOT_DIR/docs/tasks"

if [ ! -d "$TASK_DIR" ]; then
  echo "❌ Task 디렉터리를 찾을 수 없습니다: $TASK_DIR" >&2
  exit 1
fi

missing=0

for file in "$TASK_DIR"/*.yaml; do
  [ -e "$file" ] || continue
  if ! grep -q '^required_tests:' "$file"; then
    echo "⚠️  required_tests 섹션 누락: ${file#$ROOT_DIR/}"
    missing=1
    continue
  fi

  if ! awk '
    /^required_tests:/ { in_section=1; next }
    /^post_updates:/ { in_section=0 }
    in_section && /^  - / { has_item=1 }
    END {
      exit(has_item ? 0 : 1)
    }
  ' "$file"; then
    echo "⚠️  required_tests 항목이 비어있습니다: ${file#$ROOT_DIR/}"
    missing=1
  fi
done

exit $missing
