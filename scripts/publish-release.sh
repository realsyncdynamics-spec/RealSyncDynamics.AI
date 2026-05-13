#!/usr/bin/env bash
#
# Publish a release. Usage:
#
#   ./scripts/publish-release.sh [--dry-run]
#
# Behavior:
#   1. Reads version from package.json.
#   2. Verifies the tag does not exist locally or on origin.
#   3. Verifies HEAD is on the default branch (main/master).
#   4. Verifies the working tree is clean.
#   5. Creates an annotated tag v<version>.
#   6. Pushes the tag.
#   7. Lists the last 5 commits since the previous tag for context.
#   8. If `gh` CLI is available: gh release create with auto-generated notes.
#      Otherwise: prints instructions for manual GitHub Release.
#
# Safety:
#   - never force-push, never delete tags
#   - aborts if tag exists
#   - aborts if working tree dirty
#   - DRY_RUN echoes destructive actions only

set -euo pipefail

if [[ -t 1 ]]; then
  GREEN=$'\033[32m'; RED=$'\033[31m'; YELLOW=$'\033[33m'; BLUE=$'\033[34m'; RESET=$'\033[0m'
else
  GREEN=""; RED=""; YELLOW=""; BLUE=""; RESET=""
fi

step()  { printf "%s▶%s %s\n" "$BLUE" "$RESET" "$*"; }
ok()    { printf "%s✓%s %s\n" "$GREEN" "$RESET" "$*"; }
warn()  { printf "%s!%s %s\n" "$YELLOW" "$RESET" "$*"; }
fail()  { printf "%s✗%s %s\n" "$RED" "$RESET" "$*" >&2; exit 1; }

DRY_RUN="false"
for arg in "$@"; do [[ "$arg" == "--dry-run" ]] && DRY_RUN="true"; done

if [[ "$DRY_RUN" == "true" ]]; then
  warn "DRY_RUN mode — tag + push + release will be echoed, not executed."
fi

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "Not inside a git repository."

# ─── Version from package.json ────────────────────────────────────────
[[ -f package.json ]] || fail "package.json not found in cwd."
VERSION="$(node -p "require('./package.json').version" 2>/dev/null || true)"
[[ -n "$VERSION" ]] || fail "Could not read version from package.json."
TAG="v$VERSION"
step "Version $VERSION → tag $TAG"

# ─── Default branch + branch check ────────────────────────────────────
DEFAULT_BRANCH="$(git remote show origin 2>/dev/null | awk '/HEAD branch/ {print $NF}' || true)"
if [[ -z "$DEFAULT_BRANCH" ]]; then
  if git rev-parse --verify --quiet origin/main >/dev/null; then DEFAULT_BRANCH="main"
  elif git rev-parse --verify --quiet origin/master >/dev/null; then DEFAULT_BRANCH="master"
  else fail "Could not determine default branch."
  fi
fi
CURRENT="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$CURRENT" != "$DEFAULT_BRANCH" ]]; then
  fail "Not on default branch ($DEFAULT_BRANCH). Checked out: $CURRENT. Abort."
fi
step "On default branch: $DEFAULT_BRANCH"

# ─── Working tree clean ───────────────────────────────────────────────
if ! git diff --quiet || ! git diff --cached --quiet; then
  fail "Working tree has uncommitted changes. Commit or stash first."
fi
ok "Working tree clean."

# ─── Tag exists check ─────────────────────────────────────────────────
if git rev-parse --verify --quiet "$TAG" >/dev/null; then
  fail "Tag $TAG already exists locally. Bump version in package.json or delete the tag."
fi
git fetch --tags origin
if git rev-parse --verify --quiet "refs/tags/$TAG" >/dev/null; then
  fail "Tag $TAG exists on origin. Refusing to overwrite."
fi
ok "Tag $TAG is fresh."

# ─── Create + push tag ────────────────────────────────────────────────
step "Create annotated tag $TAG"
if [[ "$DRY_RUN" == "true" ]]; then
  echo "  (dry-run) git tag -a $TAG -m \"Release $TAG\""
  echo "  (dry-run) git push origin $TAG"
else
  git tag -a "$TAG" -m "Release $TAG"
  git push origin "$TAG"
fi
ok "Tag created + pushed."

# ─── Release summary ──────────────────────────────────────────────────
step "Recent commits"
PREV_TAG="$(git describe --tags --abbrev=0 "$TAG^" 2>/dev/null || true)"
if [[ -n "$PREV_TAG" ]]; then
  printf "%s\n" "  Commits since $PREV_TAG:"
  git log --oneline "$PREV_TAG..$TAG" 2>/dev/null | head -10 | sed 's/^/    /'
else
  printf "%s\n" "  Last 5 commits:"
  git log --oneline -5 | sed 's/^/    /'
fi

# ─── GitHub Release ───────────────────────────────────────────────────
if command -v gh >/dev/null 2>&1; then
  step "gh CLI detected — creating GitHub Release"
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "  (dry-run) gh release create $TAG --generate-notes --title \"Release $TAG\""
  else
    gh release create "$TAG" --generate-notes --title "Release $TAG"
  fi
  ok "GitHub Release published."
else
  warn "gh CLI not found. Create the release manually at https://github.com/<owner>/<repo>/releases/new?tag=$TAG"
fi

ok "Release $TAG done."
if [[ "$DRY_RUN" == "true" ]]; then
  warn "Reminder: this was a DRY-RUN. Nothing was actually tagged or pushed."
fi
