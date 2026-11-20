#!/usr/bin/env bash
# SF-008: EPHEMERAL TEST DATABASE ONLY. Never pass a production DSN.
set -euo pipefail
if [[ "${SF008_EPHEMERAL_DB:-}" != "true" ||
      "${PGHOST:-}" != "127.0.0.1" ||
      "${PGPORT:-}" != "5432" ||
      "${PGDATABASE:-}" != "sf008_test" ||
      "${PGUSER:-}" != "postgres" ||
      -z "${PGPASSWORD:-}" ||
      -n "${PGHOSTADDR:-}" ||
      -n "${PGSERVICE:-}" ]]; then
  echo "SF-008 refused: requires explicit ephemeral localhost sf008_test DB." >&2
  exit 64
fi
command -v psql >/dev/null || { echo "psql required" >&2; exit 65; }
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
psql_safe() {
  psql -X -h 127.0.0.1 -p 5432 -U postgres -d sf008_test -v ON_ERROR_STOP=1 "$@"
}
actual="$(psql_safe -Atqc 'SELECT current_database()')"
[[ "$actual" == "sf008_test" ]] || { echo "Unexpected database" >&2; exit 66; }

psql_safe -qf "$here/schema.sql"
psql_safe -qf "$here/assertions.sql"

tmp="$(mktemp -d)"
trap 'rm -rf -- "$tmp"' EXIT

# A different DB role must not be able to read the private factory schema.
if psql_safe -Atqc 'SET ROLE sf008_intruder; SELECT count(*) FROM sf008.jobs;' >"$tmp/intruder" 2>&1; then
  echo "SF-008 FAIL: intruder could read private schema" >&2
  exit 67
fi
grep -qi 'permission denied' "$tmp/intruder" ||
  { echo "SF-008 FAIL: wrong intruder failure" >&2; exit 68; }

# Two truly independent PostgreSQL sessions race against expected_version=0.
psql_safe -Atqc "SET ROLE sf008_worker; SELECT sf008.advance('internal_A','race',0,'race_a',repeat('1',64),'running');" >"$tmp/a" 2>&1 &
pa=$!
psql_safe -Atqc "SET ROLE sf008_worker; SELECT sf008.advance('internal_A','race',0,'race_b',repeat('2',64),'running');" >"$tmp/b" 2>&1 &
pb=$!
set +e
wait "$pa"; sa=$?
wait "$pb"; sb=$?
set -e

if ! { [[ "$sa" -eq 0 && "$sb" -ne 0 ]] || [[ "$sb" -eq 0 && "$sa" -ne 0 ]]; }; then
  echo "SF-008 FAIL: expected exactly one CAS winner (codes $sa, $sb)" >&2
  exit 69
fi
if [[ "$sa" -eq 0 ]]; then winner="$tmp/a"; loser="$tmp/b"; else winner="$tmp/b"; loser="$tmp/a"; fi
grep -q '^committed$' "$winner" ||
  { echo "SF-008 FAIL: successful transaction did not commit" >&2; exit 70; }
grep -q 'version_conflict' "$loser" ||
  { echo "SF-008 FAIL: losing transaction did not report CAS conflict" >&2; exit 71; }

counts="$(psql_safe -Atqc "SELECT
  (SELECT version FROM sf008.jobs WHERE scope_id='internal_A' AND job_id='race')::text || ':' ||
  (SELECT count(*) FROM sf008.events WHERE job_id='race')::text || ':' ||
  (SELECT count(*) FROM sf008.receipts WHERE job_id='race')::text || ':' ||
  (SELECT count(*) FROM sf008.outbox WHERE job_id='race')::text || ':' ||
  (SELECT count(*) FROM sf008.cost_ledger WHERE job_id='race')::text;")"
[[ "$counts" == "1:1:1:1:1" ]] ||
  { echo "SF-008 FAIL: racing transaction wrote inconsistent artifacts: $counts" >&2; exit 72; }

echo "SF008_PG_OK: atomic rollback, replay/conflict, scope RLS, denied intruder, fencing, two-session CAS"
