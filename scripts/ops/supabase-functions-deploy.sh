#!/usr/bin/env bash
# scripts/ops/supabase-functions-deploy.sh
#
# CLI-Wrapper für Edge-Function-Deploy mit korrekter verify_jwt-Logik
# aus supabase/config.toml. Spiegelt den Job aus .github/workflows/deploy.yml,
# damit der gleiche Mechanismus auch ohne CI/CD reproduzierbar ist.
#
# Setzt voraus:
#   - supabase CLI installiert
#   - SUPABASE_ACCESS_TOKEN gesetzt
#   - SUPABASE_PROJECT_ID gesetzt
#
# Usage:
#   scripts/ops/supabase-functions-deploy.sh                 # alle Functions
#   scripts/ops/supabase-functions-deploy.sh <function>      # eine gezielt
#   scripts/ops/supabase-functions-deploy.sh --dry-run       # nur listen
#   scripts/ops/supabase-functions-deploy.sh --only-changed  # nur seit letztem Commit geänderte
#
# Sicherheit:
#   - bricht ab wenn Function-Verzeichnis fehlt oder index.ts nicht da ist
#   - liefert pro Function explizit --no-verify-jwt wenn config.toml es so vorsieht
#   - keine implizite Config-Migration

set -uo pipefail

DRY_RUN=0
ONLY_CHANGED=0
TARGET=""

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run)      DRY_RUN=1; shift ;;
    --only-changed) ONLY_CHANGED=1; shift ;;
    -h|--help)      sed -n '2,22p' "$0"; exit 0 ;;
    -*)             echo "unbekanntes Flag: $1" >&2; exit 2 ;;
    *)              TARGET="$1"; shift ;;
  esac
done

if ! command -v supabase >/dev/null 2>&1; then
  echo "FEHLER: supabase CLI nicht im PATH." >&2
  exit 3
fi
: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN nicht gesetzt}"
: "${SUPABASE_PROJECT_ID:?SUPABASE_PROJECT_ID nicht gesetzt}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

[ -f supabase/config.toml ] || { echo "FEHLER: supabase/config.toml fehlt" >&2; exit 1; }

# Parse Functions mit verify_jwt = false aus config.toml
# (identisch zur Logik in .github/workflows/deploy.yml)
NO_JWT=$(awk '
  /^\[functions\./ { name = $0; sub(/^\[functions\./, "", name); sub(/\]$/, "", name); next }
  /^verify_jwt[[:space:]]*=[[:space:]]*false/ && name != "" { print name; name = "" }
  /^\[/ && !/^\[functions\./ { name = "" }
' supabase/config.toml | sort -u)

# Welche Functions deployen?
if [ -n "$TARGET" ]; then
  TARGETS="$TARGET"
elif [ "$ONLY_CHANGED" = "1" ]; then
  if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "FEHLER: --only-changed braucht git-Repo." >&2; exit 1
  fi
  BASE="${DIFF_BASE:-origin/main}"
  TARGETS=$(git diff --name-only "$BASE"...HEAD -- 'supabase/functions/' \
    | awk -F/ '$2=="functions" && $3 !~ /^_/ {print $3}' | sort -u)
  if [ -z "$TARGETS" ]; then
    echo "Keine Function-Änderungen seit $BASE — nichts zu tun."
    exit 0
  fi
else
  TARGETS=$(find supabase/functions -maxdepth 1 -mindepth 1 -type d \
    ! -name '_*' -printf '%f\n' | sort)
fi

echo "════ Function-Deploy · project=$SUPABASE_PROJECT_ID ════"
echo "Functions mit verify_jwt=false:"
echo "$NO_JWT" | sed 's/^/  · /' | head -30
echo
echo "Zu deployen:"
echo "$TARGETS" | sed 's/^/  · /'

if [ "$DRY_RUN" = "1" ]; then
  echo
  echo "(--dry-run aktiv — kein Deploy)"
  exit 0
fi

echo
read -r -p "Deploy starten? [y/N] " ans
[ "$ans" = "y" ] || [ "$ans" = "Y" ] || { echo "abgebrochen."; exit 0; }

FAILED=""
for fn in $TARGETS; do
  dir="supabase/functions/$fn"
  if [ ! -f "$dir/index.ts" ]; then
    echo "WARN: $fn — kein index.ts, überspringe"
    continue
  fi
  if echo "$NO_JWT" | grep -qx "$fn"; then
    echo "→ deploy $fn --no-verify-jwt"
    if ! supabase functions deploy "$fn" --no-verify-jwt \
         --project-ref "$SUPABASE_PROJECT_ID"; then
      FAILED="$FAILED $fn"
    fi
  else
    echo "→ deploy $fn (verify_jwt=default)"
    if ! supabase functions deploy "$fn" \
         --project-ref "$SUPABASE_PROJECT_ID"; then
      FAILED="$FAILED $fn"
    fi
  fi
done

if [ -n "$FAILED" ]; then
  echo
  echo "FEHLER bei:$FAILED" >&2
  exit 1
fi
echo
echo "✓ alle Functions deployed"
