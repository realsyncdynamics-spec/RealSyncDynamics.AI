#!/usr/bin/env bash
# scripts/ops/supabase-secrets.sh
#
# Wrapper für Edge-Function-Secrets ohne Dashboard. Liest/Schreibt/Löscht
# Secrets via supabase CLI. Hilft auch, lokale .env auf das Projekt zu syncen.
#
# Setzt voraus:
#   - supabase CLI installiert
#   - SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_ID gesetzt
#
# Usage:
#   scripts/ops/supabase-secrets.sh list
#   scripts/ops/supabase-secrets.sh set KEY=VALUE [KEY2=VALUE2 ...]
#   scripts/ops/supabase-secrets.sh unset KEY [KEY2 ...]
#   scripts/ops/supabase-secrets.sh push <env-file>     # syncs all from file
#   scripts/ops/supabase-secrets.sh diff <env-file>     # zeigt Drift, kein Schreiben
#
# Sicherheit:
#   - 'set' und 'push' bestätigen vor dem Schreiben
#   - 'list' zeigt nur Namen, keine Werte
#   - .env-Files werden NICHT als Klartext geloggt

set -uo pipefail

CMD="${1:-}"; shift || true

if [ -z "$CMD" ]; then
  sed -n '2,22p' "$0"; exit 0
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "FEHLER: supabase CLI nicht im PATH." >&2; exit 3
fi
: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN nicht gesetzt}"
: "${SUPABASE_PROJECT_ID:?SUPABASE_PROJECT_ID nicht gesetzt}"

PROJECT_FLAG=(--project-ref "$SUPABASE_PROJECT_ID")

case "$CMD" in
  list)
    supabase secrets list "${PROJECT_FLAG[@]}"
    ;;

  set)
    [ $# -gt 0 ] || { echo "Usage: set KEY=VALUE [...]" >&2; exit 2; }
    echo "Wird setzen:"
    for kv in "$@"; do
      printf '  %s=***\n' "${kv%%=*}"
    done
    read -r -p "Continue? [y/N] " ans
    [ "$ans" = "y" ] || [ "$ans" = "Y" ] || { echo "abgebrochen."; exit 0; }
    supabase secrets set "${PROJECT_FLAG[@]}" "$@"
    ;;

  unset)
    [ $# -gt 0 ] || { echo "Usage: unset KEY [...]" >&2; exit 2; }
    echo "Wird löschen: $*"
    read -r -p "Continue? [y/N] " ans
    [ "$ans" = "y" ] || [ "$ans" = "Y" ] || { echo "abgebrochen."; exit 0; }
    supabase secrets unset "${PROJECT_FLAG[@]}" "$@"
    ;;

  push)
    ENV_FILE="${1:-}"
    [ -n "$ENV_FILE" ] && [ -f "$ENV_FILE" ] \
      || { echo "Usage: push <env-file>" >&2; exit 2; }
    echo "Wird alle Variablen aus $ENV_FILE setzen:"
    grep -E '^[A-Z_][A-Z0-9_]*=' "$ENV_FILE" | awk -F= '{print "  " $1}'
    read -r -p "Continue? [y/N] " ans
    [ "$ans" = "y" ] || [ "$ans" = "Y" ] || { echo "abgebrochen."; exit 0; }
    supabase secrets set "${PROJECT_FLAG[@]}" --env-file "$ENV_FILE"
    ;;

  diff)
    ENV_FILE="${1:-}"
    [ -n "$ENV_FILE" ] && [ -f "$ENV_FILE" ] \
      || { echo "Usage: diff <env-file>" >&2; exit 2; }
    echo "Remote-Secrets:"
    REMOTE=$(supabase secrets list "${PROJECT_FLAG[@]}" 2>/dev/null \
      | awk 'NR>2 {print $1}' | sort -u)
    echo "$REMOTE" | sed 's/^/  /'
    LOCAL=$(grep -E '^[A-Z_][A-Z0-9_]*=' "$ENV_FILE" | awk -F= '{print $1}' | sort -u)
    echo
    echo "Nur lokal (würde gepushed):"
    comm -23 <(echo "$LOCAL") <(echo "$REMOTE") | sed 's/^/  + /'
    echo "Nur remote (im env-file fehlt):"
    comm -13 <(echo "$LOCAL") <(echo "$REMOTE") | sed 's/^/  - /'
    ;;

  -h|--help|help)
    sed -n '2,22p' "$0"
    ;;

  *)
    echo "Unbekanntes Kommando: $CMD" >&2
    sed -n '2,22p' "$0" >&2
    exit 2
    ;;
esac
