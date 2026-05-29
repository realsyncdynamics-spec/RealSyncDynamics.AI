#!/usr/bin/env bash
# scripts/ops/supabase-status.sh
#
# Read-Only-Übersicht des verlinkten Supabase-Projekts:
#   - link-Status
#   - lokale vs. remote Migrations (Drift-Detection)
#   - Edge-Function-Liste
#   - Advisor-Warnings
#
# Setzt voraus:
#   - supabase CLI installiert (https://supabase.com/docs/guides/cli)
#   - SUPABASE_ACCESS_TOKEN gesetzt (PAT, account → Access Tokens)
#   - SUPABASE_PROJECT_ID gesetzt (xxxx in xxxx.supabase.co)
#
# Usage:
#   scripts/ops/supabase-status.sh
#   scripts/ops/supabase-status.sh --migrations-only
#
# Sicher: macht keine Schreibzugriffe auf das Projekt.

set -u

ONLY_MIGRATIONS=0
while [ $# -gt 0 ]; do
  case "$1" in
    --migrations-only) ONLY_MIGRATIONS=1; shift ;;
    -h|--help) sed -n '2,18p' "$0"; exit 0 ;;
    *) echo "unbekanntes Argument: $1" >&2; exit 2 ;;
  esac
done

# Pre-Flight
if ! command -v supabase >/dev/null 2>&1; then
  cat >&2 <<EOF
FEHLER: supabase CLI nicht im PATH.
Install:
  npm i -g supabase
  # oder: brew install supabase/tap/supabase
  # oder: https://github.com/supabase/cli/releases
EOF
  exit 3
fi

: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN nicht gesetzt}"
: "${SUPABASE_PROJECT_ID:?SUPABASE_PROJECT_ID nicht gesetzt}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

printf '════ Supabase-Status · project=%s · %s ════\n' \
  "$SUPABASE_PROJECT_ID" "$(date -u +%FT%TZ)"

# Link-Status (lazy — link() ist idempotent und schreibt nur lokal in .temp)
printf '\n──── Link ────\n'
if [ ! -f supabase/.temp/project-ref ] \
   || [ "$(cat supabase/.temp/project-ref 2>/dev/null)" != "$SUPABASE_PROJECT_ID" ]; then
  echo '· project nicht verlinkt — verlinke jetzt'
  supabase link --project-ref "$SUPABASE_PROJECT_ID" 2>&1 | sed 's/^/  /'
else
  echo "· verlinkt: $SUPABASE_PROJECT_ID"
fi

# Migrations-Drift
printf '\n──── Migrations ────\n'
LOCAL_COUNT=$(find supabase/migrations -name '*.sql' -type f 2>/dev/null | wc -l)
printf '· lokal in supabase/migrations: %s files\n' "$LOCAL_COUNT"

echo '· supabase migration list --linked:'
LIST_OUT=$(supabase migration list --linked 2>&1)
echo "$LIST_OUT" | sed 's/^/  /'

# Drift-Klassifikation
PENDING=$(echo "$LIST_OUT" | awk '/^[[:space:]]*[0-9]+[[:space:]]+\|[[:space:]]+$/' | wc -l)
REMOTE_ONLY=$(echo "$LIST_OUT" | awk '/^[[:space:]]*\|[[:space:]]+[0-9]+/' | wc -l)
printf '\n· Drift-Zusammenfassung:\n'
printf '    local-only (pending push): ~%s\n' "$PENDING"
printf '    remote-only (drift!):      ~%s\n' "$REMOTE_ONLY"
if [ "$REMOTE_ONLY" -gt 0 ]; then
  echo '    ⚠ Remote-only Migrations bedeuten: jemand hat im Dashboard / per psql geändert.'
  echo '      Optionen: supabase migration repair --status applied <ID>'
  echo '                (oder reverted, wenn lokal nicht haben soll)'
fi

[ "$ONLY_MIGRATIONS" = "1" ] && exit 0

# Edge-Functions
printf '\n──── Edge Functions ────\n'
LOCAL_FNS=$(find supabase/functions -maxdepth 1 -mindepth 1 -type d \
  ! -name '_*' 2>/dev/null | wc -l)
printf '· lokal: %s functions (excl. _shared/_internal)\n' "$LOCAL_FNS"

echo '· remote (supabase functions list):'
supabase functions list --project-ref "$SUPABASE_PROJECT_ID" 2>&1 \
  | sed 's/^/  /' | head -80

# Advisor-Warnings (security/performance) — nur wenn 'inspect' verfügbar
if supabase --help 2>&1 | grep -q 'inspect'; then
  printf '\n──── Advisor (inspect) ────\n'
  supabase inspect db locks 2>&1 | sed 's/^/  /' | head -10 || true
fi

printf '\n──── ENDE ────\n'
