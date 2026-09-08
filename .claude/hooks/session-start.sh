#!/bin/bash
set -euo pipefail

echo '{"async": true, "asyncTimeout": 600000}'

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# --loglevel=error: Die Ausgabe dieses Hooks landet im Sitzungskontext und
# kostet dort in jeder Sitzung Tokens. Die Fortschrittszeilen von npm sagen
# niemandem etwas; Fehler bleiben sichtbar (CLAUDE.md §0).
npm install --no-audit --no-fund --loglevel=error
