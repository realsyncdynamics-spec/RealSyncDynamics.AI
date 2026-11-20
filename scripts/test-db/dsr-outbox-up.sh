#!/usr/bin/env bash
# Isolated test DB only. Never use a production database URL with this script.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DB_URL="$(bash "$ROOT/scripts/test-db/up.sh")"
if [[ "$DB_URL" != postgresql://postgres@127.0.0.1:* && "$DB_URL" != postgresql://postgres@localhost:* ]]; then
  echo "Refusing non-local Postgres URL" >&2
  exit 1
fi
# The general SPEC-001 fixture does not include these older DSR dependencies.
psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
SQL
for migration in \
  "$ROOT/supabase/migrations/20260514100000_governance_admin_log.sql" \
  "$ROOT/supabase/migrations/20260515200000_dsr_tracker.sql" \
  "$ROOT/supabase/migrations/20261120040000_dsr_evidence_outbox.sql"; do
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$migration" >/dev/null
done
echo "$DB_URL"
