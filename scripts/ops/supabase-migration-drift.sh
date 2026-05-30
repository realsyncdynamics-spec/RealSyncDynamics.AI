#!/usr/bin/env bash
# scripts/ops/supabase-migration-drift.sh
#
# Adressiert R2 aus dem Phase-1-Audit: die hartcodierte Migration-Repair-Liste
# in .github/workflows/deploy.yml (177 IDs). Diese ist nicht wartbar.
#
# Was dieses Skript macht:
#   1. holt aktuelle migration list vom verlinkten Projekt
#   2. klassifiziert: local-only, remote-only, in-sync
#   3. schlägt für jede Drift-Migration einen repair-Befehl vor — führt ihn
#      NICHT automatisch aus
#   4. schreibt Vorschläge in scripts/ops/.migration-drift-suggested.sh, das
#      du nach Review manuell ausführst
#
# Setzt voraus:
#   - supabase CLI installiert
#   - SUPABASE_ACCESS_TOKEN gesetzt
#   - SUPABASE_PROJECT_ID gesetzt
#
# Usage:
#   scripts/ops/supabase-migration-drift.sh
#
# Sicherheit:
#   - read-only auf remote
#   - schreibt nur lokale Datei mit Vorschlägen
#   - kein automatischer migration repair

set -uo pipefail

if ! command -v supabase >/dev/null 2>&1; then
  echo "FEHLER: supabase CLI nicht im PATH." >&2; exit 3
fi
: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN nicht gesetzt}"
: "${SUPABASE_PROJECT_ID:?SUPABASE_PROJECT_ID nicht gesetzt}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

OUT="scripts/ops/.migration-drift-suggested.sh"

echo "════ Migration-Drift-Analyse · $(date -u +%FT%TZ) ════"

# Lokale Migrations sammeln
LOCAL_IDS=$(find supabase/migrations -name '*.sql' -type f -printf '%f\n' \
  | sed -E 's/^([0-9_]+)_.*$/\1/' | sed -E 's/_.*$//' | sort -u)
LOCAL_N=$(echo "$LOCAL_IDS" | grep -c .)
echo "· lokal: $LOCAL_N Migrations"

# Remote-Liste holen
echo "· hole migration list --linked …"
RAW=$(supabase migration list --linked 2>&1)
if echo "$RAW" | grep -qi 'error\|failed'; then
  echo "FEHLER beim Holen der Remote-Liste:" >&2
  echo "$RAW" >&2
  exit 1
fi

# Format der supabase-CLI-Tabelle: "  Local        |  Remote       |  Time"
# Spalte 1 = lokal vorhanden, Spalte 2 = remote vorhanden.
LOCAL_ONLY=$(echo "$RAW" | awk -F'|' '
  /^[[:space:]]*[0-9]+[[:space:]]*\|[[:space:]]*\|/ { gsub(/[[:space:]]/, "", $1); print $1 }')
REMOTE_ONLY=$(echo "$RAW" | awk -F'|' '
  /^[[:space:]]*\|[[:space:]]*[0-9]+/ { gsub(/[[:space:]]/, "", $2); print $2 }')

LO_N=$(echo "$LOCAL_ONLY" | grep -c . || true)
RO_N=$(echo "$REMOTE_ONLY" | grep -c . || true)

echo
echo "──── Klassifikation ────"
echo "  local-only (pending push):  $LO_N"
echo "  remote-only (drift!):       $RO_N"

# Vorschläge schreiben
cat > "$OUT" <<EOF
#!/usr/bin/env bash
# AUTOGENERIERT von scripts/ops/supabase-migration-drift.sh
# Datum: $(date -u +%FT%TZ)
# Projekt: $SUPABASE_PROJECT_ID
#
# REVIEW VOR AUSFÜHRUNG. Dieses Skript führt repair-Operationen aus, die das
# remote migration history bearbeiten. Nicht blind ausführen.
#
# Strategie:
#   - local-only:  supabase db push --include-all              → Migrations remote anwenden
#   - remote-only: zwei Optionen, pro ID entscheiden:
#       a) supabase migration repair --status applied <ID>     → akzeptieren als "ist schon drin"
#       b) supabase migration repair --status reverted <ID>    → ignorieren / lokal nachziehen

set -eu
EOF
chmod +x "$OUT"

if [ -n "$LOCAL_ONLY" ]; then
  echo
  echo "──── Local-only Migrations (push pending) ────"
  echo "$LOCAL_ONLY" | sed 's/^/  /' | head -20
  {
    echo
    echo "# ── Local-only Migrations → push ──"
    echo "# (pushed alle pending; alternativ einzeln review)"
    echo "supabase db push --include-all --project-ref $SUPABASE_PROJECT_ID"
  } >> "$OUT"
fi

if [ -n "$REMOTE_ONLY" ]; then
  echo
  echo "──── Remote-only Migrations (Drift!) ────"
  echo "$REMOTE_ONLY" | sed 's/^/  /' | head -30
  {
    echo
    echo "# ── Remote-only Migrations → ENTSCHEIDUNG ──"
    echo "# Für jede ID auskommentieren welche Option du willst:"
    while IFS= read -r id; do
      [ -z "$id" ] && continue
      echo "# $id:"
      echo "#   supabase migration repair --status applied  $id --project-ref $SUPABASE_PROJECT_ID"
      echo "#   supabase migration repair --status reverted $id --project-ref $SUPABASE_PROJECT_ID"
    done <<< "$REMOTE_ONLY"
  } >> "$OUT"
fi

if [ -z "$LOCAL_ONLY" ] && [ -z "$REMOTE_ONLY" ]; then
  echo
  echo "✓ kein Drift — local und remote sind in sync."
  echo "# ✓ kein Drift — nichts zu reparieren." >> "$OUT"
fi

echo
echo "──── Vorschläge geschrieben ────"
echo "  $OUT"
echo "  Review + auskommentieren, dann: bash $OUT"
echo
echo "Hinweis: $OUT ist in .gitignore (siehe README) und sollte nicht"
echo "         commited werden — Drift ist projekt- und zeitabhängig."
