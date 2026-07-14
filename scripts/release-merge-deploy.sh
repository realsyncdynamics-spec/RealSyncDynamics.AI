#!/usr/bin/env bash
#
# Safe merge + build + deploy. Usage:
#
#   ./scripts/release-merge-deploy.sh <feature-branch> [--dry-run]
#
# Behavior:
#   1. Verifies the working tree is clean.
#   2. Auto-detects the default branch (main / master).
#   3. Auto-detects package manager (pnpm > yarn > npm).
#   4. Fetches origin, checks out the feature branch, pulls latest.
#   5. Switches to default branch, pulls latest.
#   6. Merges the feature branch with --no-ff into default.
#   7. Runs install + lint + typecheck + test + build (only the
#      scripts that exist in package.json).
#   8. On clean build: pushes default branch.
#   9. Auto-deploys via Wrangler CLI (Cloudflare Pages) if available.
#  10. Notes GitHub Actions deploy is triggered by the push otherwise.
#
# Safety rules (hard, never violated):
#   - never force-push
#   - never delete branches
#   - never skip hooks
#   - on any failure: abort, NOTHING pushed
#   - DRY_RUN: all destructive actions are echoed, not executed
#   - never echoes secrets

set -euo pipefail

# ─── Colors ────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  GREEN=$'\033[32m'; RED=$'\033[31m'; YELLOW=$'\033[33m'; BLUE=$'\033[34m'; RESET=$'\033[0m'
else
  GREEN=""; RED=""; YELLOW=""; BLUE=""; RESET=""
fi

step()    { printf "%s▶%s %s\n" "$BLUE" "$RESET" "$*"; }
ok()      { printf "%s✓%s %s\n" "$GREEN" "$RESET" "$*"; }
warn()    { printf "%s!%s %s\n" "$YELLOW" "$RESET" "$*"; }
fail()    { printf "%s✗%s %s\n" "$RED" "$RESET" "$*" >&2; exit 1; }

# ─── Parse args ───────────────────────────────────────────────────────
BRANCH="${1:-}"
DRY_RUN="false"
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN="true" ;;
  esac
done

if [[ -z "$BRANCH" || "$BRANCH" == --* ]]; then
  fail "Usage: $0 <feature-branch> [--dry-run]"
fi

if [[ "$DRY_RUN" == "true" ]]; then
  warn "DRY_RUN mode — destructive actions are echoed, not executed."
fi

# ─── Sanity checks ────────────────────────────────────────────────────
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "Not inside a git repository."

if ! git diff --quiet || ! git diff --cached --quiet; then
  fail "Working tree has uncommitted changes. Commit or stash first."
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
step "Current branch: $CURRENT_BRANCH"

# ─── Detect default branch ────────────────────────────────────────────
DEFAULT_BRANCH=""
if git remote show origin >/dev/null 2>&1; then
  DEFAULT_BRANCH="$(git remote show origin 2>/dev/null | awk '/HEAD branch/ {print $NF}' || true)"
fi
if [[ -z "$DEFAULT_BRANCH" ]]; then
  if git rev-parse --verify --quiet origin/main >/dev/null; then DEFAULT_BRANCH="main"
  elif git rev-parse --verify --quiet origin/master >/dev/null; then DEFAULT_BRANCH="master"
  else fail "Could not determine default branch (no origin/main or origin/master)."
  fi
fi
step "Default branch: $DEFAULT_BRANCH"

if [[ "$BRANCH" == "$DEFAULT_BRANCH" ]]; then
  fail "Refusing to merge default branch into itself."
fi

# ─── Detect package manager ───────────────────────────────────────────
PM=""
PM_INSTALL=""
if [[ -f pnpm-lock.yaml ]] && command -v pnpm >/dev/null 2>&1; then
  PM="pnpm"; PM_INSTALL="pnpm install --frozen-lockfile"
elif [[ -f yarn.lock ]] && command -v yarn >/dev/null 2>&1; then
  PM="yarn"; PM_INSTALL="yarn install --frozen-lockfile"
elif [[ -f package-lock.json ]] && command -v npm >/dev/null 2>&1; then
  PM="npm"; PM_INSTALL="npm ci"
else
  PM="npm"; PM_INSTALL="npm install"
fi
step "Package manager: $PM"

has_script() { node -e "process.exit(require('./package.json').scripts && require('./package.json').scripts['$1'] ? 0 : 1)" 2>/dev/null; }
run_script() {
  local script="$1"
  if has_script "$script"; then
    step "$PM run $script"
    if [[ "$DRY_RUN" == "true" ]]; then
      echo "  (dry-run) $PM run $script"
    else
      "$PM" run "$script"
    fi
  else
    warn "no \"$script\" script in package.json — skipping"
  fi
}

# ─── Fetch + checkout feature branch ──────────────────────────────────
step "git fetch origin"
git fetch origin

step "Checkout feature branch: $BRANCH"
if git rev-parse --verify --quiet "$BRANCH" >/dev/null; then
  git checkout "$BRANCH"
elif git rev-parse --verify --quiet "origin/$BRANCH" >/dev/null; then
  git checkout -b "$BRANCH" "origin/$BRANCH"
else
  fail "Branch $BRANCH does not exist locally or on origin."
fi
git pull --ff-only origin "$BRANCH"
ok "Feature branch up to date."

# ─── Switch to default + pull ─────────────────────────────────────────
step "Checkout default branch: $DEFAULT_BRANCH"
git checkout "$DEFAULT_BRANCH"
git pull --ff-only origin "$DEFAULT_BRANCH"
ok "Default branch up to date."

# ─── Merge ─────────────────────────────────────────────────────────────
MERGE_MSG="chore(release): merge $BRANCH into $DEFAULT_BRANCH"
step "Merge --no-ff: $BRANCH"
if [[ "$DRY_RUN" == "true" ]]; then
  echo "  (dry-run) git merge --no-ff $BRANCH -m \"$MERGE_MSG\""
else
  git merge --no-ff "$BRANCH" -m "$MERGE_MSG"
fi
ok "Merge complete (local)."

# ─── Build pipeline ───────────────────────────────────────────────────
step "Install dependencies"
if [[ "$DRY_RUN" == "true" ]]; then
  echo "  (dry-run) $PM_INSTALL"
else
  eval "$PM_INSTALL"
fi

run_script "lint"
# typecheck — try both common names
if has_script "typecheck"; then run_script "typecheck"
elif has_script "type-check"; then run_script "type-check"
else warn "no typecheck script — skipping"
fi
run_script "test"

# build is mandatory
if has_script "build"; then
  step "$PM run build (mandatory)"
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "  (dry-run) $PM run build"
  else
    "$PM" run build
  fi
  ok "Build clean."
else
  fail "No build script in package.json. Abort — refusing to ship without verified build."
fi

# ─── Push ──────────────────────────────────────────────────────────────
step "git push origin $DEFAULT_BRANCH"
if [[ "$DRY_RUN" == "true" ]]; then
  echo "  (dry-run) git push origin $DEFAULT_BRANCH"
else
  git push origin "$DEFAULT_BRANCH"
fi
ok "Pushed."

# ─── Deploy ────────────────────────────────────────────────────────────
step "Deploy phase"

if command -v wrangler >/dev/null 2>&1; then
    step "Wrangler CLI detected — Cloudflare Pages deploy"
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "  (dry-run)   step "Deploying to Cloudflare Pages via Wrangler""
    echo "  (dry-run)   wrangler pages deploy dist --project-name=realsync --commit-dirty=true"
      echo "  (dry-run) # wrangler deploy already echoed above"
  else
      step "Deploying to Cloudflare Pages via Wrangler"
      wrangler pages deploy dist --project-name=realsync --commit-dirty=true
    
  ok "Cloudflare Pages deploy invoked."
elif command -v netlify >/dev/null 2>&1; then
  step "Netlify CLI detected — production deploy"
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "  (dry-run) netlify deploy --build --prod"
  else
    netlify deploy --build --prod
  fi
  ok "Netlify deploy invoked."
elif [[ -d .github/workflows ]]; then
    warn "Wrangler CLI not found — relying on GitHub Actions Cloudflare deploy triggered by the push."
else
    warn "Wrangler CLI not found and no .github/workflows. Manual deploy required."
fi

ok "Release-merge-deploy completed for $BRANCH → $DEFAULT_BRANCH."
if [[ "$DRY_RUN" == "true" ]]; then
  warn "Reminder: this was a DRY-RUN. Nothing was actually pushed or deployed."
fi
