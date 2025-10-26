#!/usr/bin/env bash
# Dev environment warmup: prime Gradle/Node/Playwright caches so subsequent runs can stay offline.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# shellcheck source=../with-java-env.sh
source "$PROJECT_ROOT/with-java-env.sh"

echo "▶️ Gradle warmup (help task)"
gw_warmup

echo "▶️ Download backend dependencies (testClasses)"
gw_refresh testClasses

echo "▶️ Install frontend packages"
(cd "$PROJECT_ROOT/frontend" && npm install)

echo "▶️ Install Playwright browsers"
(cd "$PROJECT_ROOT/frontend" && npm run playwright:install)

echo "✅ Development warmup complete"
