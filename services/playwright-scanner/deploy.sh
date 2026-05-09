#!/usr/bin/env bash
# deploy.sh — Hostinger-VPS-Deploy für realsync/playwright-scanner.
#
# Usage:
#   ./deploy.sh                  # rebuild + restart
#   ./deploy.sh --pull-only      # nur git pull, ohne rebuild
#   ./deploy.sh --no-build       # nur container restart
#   ./deploy.sh --logs           # tail logs nach restart
#
# Idempotent: kann mehrfach laufen.
# Erfordert: docker, docker compose v2, .env mit SCANNER_SECRET im CWD.

set -euo pipefail

cd "$(dirname "$0")"

PROJECT_NAME="realsync-playwright-scanner"
SERVICE_NAME="scanner"

# ─── CLI args ────────────────────────────────────────────────────────────────
PULL_ONLY=false
NO_BUILD=false
TAIL_LOGS=false
for arg in "$@"; do
  case "$arg" in
    --pull-only) PULL_ONLY=true ;;
    --no-build)  NO_BUILD=true ;;
    --logs)      TAIL_LOGS=true ;;
    -h|--help)
      grep -E '^# ' "$0" | head -20
      exit 0
      ;;
    *)
      echo "Unknown arg: $arg (try --help)"
      exit 2
      ;;
  esac
done

# ─── Pre-flight ──────────────────────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker not installed"
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: docker compose v2 not installed (try: apt install docker-compose-plugin)"
  exit 1
fi

if [ ! -f .env ]; then
  echo "ERROR: .env missing. Copy from .env.example and set SCANNER_SECRET."
  exit 1
fi

if ! grep -qE '^SCANNER_SECRET=.+' .env || grep -qE '^SCANNER_SECRET=change-me' .env; then
  echo "ERROR: .env has no real SCANNER_SECRET. Generate one:"
  echo "  echo \"SCANNER_SECRET=\$(openssl rand -hex 32)\" >> .env"
  exit 1
fi

# ─── Optional: git pull ──────────────────────────────────────────────────────
if [ -d ../../.git ]; then
  echo "[deploy] git pull..."
  git -C ../.. pull --ff-only || echo "[deploy] git pull failed — continuing with current code"
fi

if [ "$PULL_ONLY" = true ]; then
  echo "[deploy] --pull-only set, exiting after git pull"
  exit 0
fi

# ─── Build (optional) ────────────────────────────────────────────────────────
if [ "$NO_BUILD" = false ]; then
  echo "[deploy] building image..."
  docker compose -p "$PROJECT_NAME" build --pull "$SERVICE_NAME"
fi

# ─── Restart ─────────────────────────────────────────────────────────────────
echo "[deploy] (re)starting container..."
docker compose -p "$PROJECT_NAME" up -d --remove-orphans "$SERVICE_NAME"

# ─── Wait for health ─────────────────────────────────────────────────────────
echo "[deploy] waiting for /health..."
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3000/health >/dev/null 2>&1; then
    echo "[deploy] healthy after ${i}s"
    curl -s http://127.0.0.1:3000/health | head -c 300
    echo
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "[deploy] FAILED — health-check did not pass within 30s"
    docker compose -p "$PROJECT_NAME" logs --tail=50 "$SERVICE_NAME"
    exit 1
  fi
  sleep 1
done

# ─── Optional: tail logs ─────────────────────────────────────────────────────
if [ "$TAIL_LOGS" = true ]; then
  echo "[deploy] tailing logs (Ctrl+C to detach)..."
  docker compose -p "$PROJECT_NAME" logs -f --tail=20 "$SERVICE_NAME"
fi

echo "[deploy] done."
