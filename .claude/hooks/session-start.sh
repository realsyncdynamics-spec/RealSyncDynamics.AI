#!/bin/bash
set -euo pipefail

echo '{"async": true, "asyncTimeout": 600000}'

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

npm install --no-audit --no-fund
