#!/usr/bin/env bash
# Räumt Remote-Branches auf, deren Arbeit erledigt ist.
#
# Warum ein Skript und keine feste Liste: Eine Liste altert ab dem Moment,
# in dem sie geschrieben wird — der nächste Merge macht sie falsch. Das Skript
# misst bei jedem Lauf neu (Lehre aus CLAUDE.md §5: messen, nicht herleiten).
#
#   ./scripts/cleanup-merged-branches.sh            # nur anzeigen (Vorgabe)
#   ./scripts/cleanup-merged-branches.sh --apply    # tatsächlich löschen
#   ./scripts/cleanup-merged-branches.sh --with-orphans [--apply]
#
# Klassen (siehe docs/BRANCH_INVENTORY.md):
#   A  Tip ist Vorfahr von main         -> gelöscht (Inhalt liegt in main)
#   B  PR vorhanden, nicht gemergt      -> gelöscht (rückholbar über refs/pull/N/head)
#   C  kein PR                          -> nur mit --with-orphans, siehe Warnung unten
#   D  offener PR                       -> bleibt
set -euo pipefail

REMOTE="${REMOTE:-origin}"
BASE="${BASE:-main}"
APPLY=0
ORPHANS=0
for a in "$@"; do
  case "$a" in
    --apply) APPLY=1 ;;
    --with-orphans) ORPHANS=1 ;;
    -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
    *) echo "Unbekannte Option: $a" >&2; exit 2 ;;
  esac
done

command -v gh >/dev/null || { echo "gh CLI wird gebraucht (für die offenen PRs)." >&2; exit 1; }

# Ein flacher Klon kann keine Abstammung prüfen — dort meldet `--merged`
# zwangsläufig zu wenig und gemergte Branches sähen ungemergt aus.
if [ "$(git rev-parse --is-shallow-repository)" = "true" ]; then
  echo "==> Klon ist flach, hole vollständige History"
  git fetch --unshallow --no-tags "$REMOTE"
fi

echo "==> Hole Branches und PR-Köpfe von $REMOTE"
git fetch "$REMOTE" --prune --quiet
git fetch "$REMOTE" "+refs/pull/*/head:refs/remotes/pr/*" --quiet

CUR="$(git rev-parse --abbrev-ref HEAD)"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT

gh pr list --state open --limit 500 --json headRefName -q '.[].headRefName' | sort -u > "$tmp/open"
git for-each-ref --format='%(objectname)' refs/remotes/pr | sort -u > "$tmp/prheads"
git branch -r --merged "$REMOTE/$BASE" \
  | sed -n "s#^ *$REMOTE/##p" | grep -v '^HEAD' | sort -u > "$tmp/ancestors"

: > "$tmp/del"; : > "$tmp/orphan"; : > "$tmp/keep"
while read -r sha name; do
  case "$name" in "$BASE"|HEAD|"$CUR") echo "$name" >> "$tmp/keep"; continue ;; esac
  if grep -qxF "$name" "$tmp/open";      then echo "$name" >> "$tmp/keep";   continue; fi
  if grep -qxF "$name" "$tmp/ancestors"; then echo "$name" >> "$tmp/del";    continue; fi
  if grep -qxF "$sha"  "$tmp/prheads";   then echo "$name" >> "$tmp/del";    continue; fi
  echo "$name" >> "$tmp/orphan"
done < <(git for-each-ref --format='%(objectname) %(refname:lstrip=3)' "refs/remotes/$REMOTE" | grep -v ' HEAD$')

[ "$ORPHANS" -eq 1 ] && cat "$tmp/orphan" >> "$tmp/del"
sort -u -o "$tmp/del" "$tmp/del"

printf '\n%s zu löschen · %s behalten (offene PRs, %s, aktueller Branch)\n' \
  "$(wc -l < "$tmp/del")" "$(wc -l < "$tmp/keep")" "$BASE"
if [ "$ORPHANS" -eq 1 ]; then
  # Ohne PR gibt es keinen refs/pull/N/head, der die Commits nach der Löschung
  # noch hielte — diese Branches sind die einzige Spur ihrer Arbeit.
  printf 'darunter %s ohne PR — nach der Löschung nicht über refs/pull rückholbar\n' \
    "$(wc -l < "$tmp/orphan")"
else
  printf '%s ohne PR übersprungen (--with-orphans nimmt sie dazu)\n' "$(wc -l < "$tmp/orphan")"
fi
sed 's/^/  /' "$tmp/del"

if [ "$APPLY" -ne 1 ]; then
  printf '\nTrockenlauf. Zum Ausführen: %s --apply\n' "$0"
  exit 0
fi

# In Stapeln, damit ein einzelner Fehler nicht den ganzen Lauf verwirft.
printf '\n==> Lösche\n'
ok=0; bad=0
while read -r -a batch; do
  refs=(); for b in "${batch[@]}"; do refs+=(":$b"); done
  if git push "$REMOTE" "${refs[@]}" >/dev/null 2>&1; then
    ok=$((ok + ${#batch[@]}))
  else
    bad=$((bad + ${#batch[@]}))
    printf '  FEHLER: %s\n' "${batch[*]}"
  fi
done < <(xargs -n 25 < "$tmp/del")
printf '\ngelöscht: %s · fehlgeschlagen: %s\n' "$ok" "$bad"
[ "$bad" -eq 0 ]
