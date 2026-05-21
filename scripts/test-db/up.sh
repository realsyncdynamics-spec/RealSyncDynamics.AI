#!/usr/bin/env bash
# scripts/test-db/up.sh
#
# Ephemeral Postgres test database for integration tests.
# Creates a fresh database, applies bootstrap.sql, then applies the
# SPEC-001 migration. Prints the connection URL on success.
#
# Reuses the system Postgres cluster (pg_lsclusters); does NOT touch
# the production-shaped data directory. Database is named with a
# timestamp suffix so parallel test runs don't collide.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BOOTSTRAP="$ROOT/scripts/test-db/bootstrap.sql"
# Apply migrations in timestamp order. Add new RFC migrations here as
# they land. SPEC-001 is the foundation; everything else depends on it.
MIGRATIONS=(
    "$ROOT/supabase/migrations/20260602000000_runtime_events_backbone.sql"
    "$ROOT/supabase/migrations/20260603000000_subject_ref_lifecycle.sql"
)

DB_NAME="${TEST_DB_NAME:-rsd_test_$(date +%s)}"
DB_USER="${TEST_DB_USER:-postgres}"
DB_HOST="${TEST_DB_HOST:-127.0.0.1}"
DB_PORT="${TEST_DB_PORT:-5432}"

for m in "${MIGRATIONS[@]}"; do
    if [[ ! -f "$m" ]]; then
        echo "FATAL: migration not found at $m" >&2
        exit 1
    fi
done

# Create DB
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $DB_NAME;" >/dev/null
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE $DB_NAME;" >/dev/null

# Bootstrap (extensions, auth schema, tenants, memberships, helpers)
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$BOOTSTRAP" >/dev/null

# Apply migrations in order
for m in "${MIGRATIONS[@]}"; do
    sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" -f "$m" >/dev/null
done

# Grant test client access via tcp/loopback as the postgres superuser
# (the migration's SECURITY DEFINER functions run as their definer
# regardless of the calling role)
echo "postgresql://postgres@$DB_HOST:$DB_PORT/$DB_NAME"
