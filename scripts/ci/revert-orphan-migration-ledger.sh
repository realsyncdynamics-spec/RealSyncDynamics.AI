#!/usr/bin/env bash
# Revert remote-only migration ledger entries that have no matching
# supabase/migrations/${version}_*.sql file. Without this, `supabase db push`
# fails with: Remote migration versions not found in local migrations directory.
#
# Intended to run in Deploy immediately before "Push migrations".
# repair --status reverted does not require a local migration file.
set -euo pipefail

orphan_versions=(
  20260924002410
  20260924013746
)

for version in "${orphan_versions[@]}"; do
  if compgen -G "supabase/migrations/${version}_*.sql" > /dev/null; then
    echo "::warning::$version hat eine Datei im Repo — nicht reverted"
    continue
  fi
  echo "Reverting orphan remote migration: $version => reverted"
  if ! supabase migration repair "$version" --status reverted; then
    echo "::warning::repair $version fehlgeschlagen oder Eintrag bereits weg"
  fi
done
