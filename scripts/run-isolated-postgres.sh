#!/usr/bin/env bash
# SF-003: Run ONLY on an isolated, disposable Linux CI VM, never on production.
# Creates a brand-new local PostgreSQL cluster in a random temporary directory.
set -Eeuo pipefail
IFS=$'\n\t'

here="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
kit="$here/sf003-kit"
for p in node npm psql; do
  command -v "$p" >/dev/null || { echo "BLOCKED: missing $p" >&2; exit 2; }
done
[[ "$(id -u)" -ne 0 ]] || { echo 'BLOCKED: must not execute as root' >&2; exit 2; }
[[ "${SF003_CI_ISOLATED_RUNNER:-}" == 'YES' ]] || {
  echo 'BLOCKED: SF003_CI_ISOLATED_RUNNER=YES required for ephemeral CI host' >&2; exit 2;
}
[[ -f "$kit/schema.sql" && -f "$kit/integration.test.mjs" ]] || {
  echo 'BLOCKED: SF-003 testkit is incomplete' >&2; exit 2;
}
# Pin the actual server engine; do not silently substitute another major.
pgbin='/usr/lib/postgresql/16/bin'
[[ -x "$pgbin/initdb" && -x "$pgbin/pg_ctl" ]] || {
  echo 'BLOCKED: PostgreSQL 16 server binaries unavailable' >&2; exit 2;
}
echo "SF-003 PostgreSQL engine: $($pgbin/postgres --version)"
# No port forward, no remote host and no external managed database is allowed.
# The runner creates its own datadir and PostgreSQL superuser.
base="${RUNNER_TEMP:-/tmp}"
[[ -d "$base" ]] || { echo 'BLOCKED: missing temporary directory' >&2; exit 2; }
work="$(mktemp -d "$base/sf003-disposable-pg.XXXXXXXX")"
chmod 700 "$work"
printf '%s\n' 'sf003-disposable-test-cluster-v1' > "$work/.sf003-marker"
started=0
cleanup() {
  exit_code=$?
  trap - EXIT
  if [[ $started -eq 1 && -f "$work/datadir/PG_VERSION" ]]; then
    "$pgbin/pg_ctl" -D "$work/datadir" -m immediate -w stop >/dev/null 2>&1 || true
  fi
  if [[ -f "$work/.sf003-marker" ]] &&
      [[ "$(cat "$work/.sf003-marker")" == 'sf003-disposable-test-cluster-v1' ]] &&
      [[ "$work" == "$base"/sf003-disposable-pg.* ]]; then
    rm -rf -- "$work"
  else
    echo 'SECURITY: cluster marker mismatch, refusing cleanup' >&2
  fi
  exit "$exit_code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

password="$(openssl rand -hex 24)"
printf '%s\n' "$password" > "$work/superuser-password"
chmod 600 "$work/superuser-password"
"$pgbin/initdb" -D "$work/datadir" -U postgres \
  --pwfile="$work/superuser-password" --auth-local=reject \
  --auth-host=scram-sha-256 --encoding=UTF8 --no-instructions >/dev/null
# Refuse to start if the required TCP port is already bound; postgres will fail closed.
# Mark start attempted before launch: a partially started process is cleaned up.
started=1
"$pgbin/pg_ctl" -D "$work/datadir" -l "$work/server.log" \
  -o "-c listen_addresses=127.0.0.1 -c port=55432 -c ssl=off -c unix_socket_directories=$work" \
  -w start >/dev/null
export PGPASSWORD="$password"
psql -h 127.0.0.1 -p 55432 -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c 'CREATE DATABASE sf003_test_factory;' >/dev/null
# The DB URL is generated here, never read from user-supplied CI secrets.
export SF003_DISPOSABLE_DB=YES SF003_SCHEMA_RESET=YES
export SF003_TEST_DATABASE_URL="postgresql://postgres:$password@127.0.0.1:55432/sf003_test_factory"
node --check "$kit/integration.test.mjs"
node --test "$kit/preflight.test.mjs"
# Dependency installation is purposefully NOT performed in this script.
# Provision and lock pg@8.21.0 in a verified, disposable workspace beforehand.
[[ -f "$kit/node_modules/pg/package.json" || -f "$here/node_modules/pg/package.json" ]] || {
  echo 'BLOCKED: pg dependency not provisioned via the reviewed lockfile' >&2; exit 2;
}
node --test "$kit/integration.test.mjs"
