#!/usr/bin/env bash
#
# scripts/deploy-frontend-vps.sh
#
# Convenience-Wrapper für frontend-vps-deploy-v2. Auf dem VPS auszuführen.
# Erwartet, dass `deploy/frontend-vps-deploy-v2/.env` bereits existiert und
# alle nötigen VITE_*-Variablen enthält.
#
# Usage:
#   ./scripts/deploy-frontend-vps.sh           # build + up
#   ./scripts/deploy-frontend-vps.sh --restart # nur restart, kein rebuild
#   ./scripts/deploy-frontend-vps.sh --logs    # nach up tail die Logs
#
# Safety:
#   - bricht ab, wenn Port belegt und nicht von eigenem Container
#   - taggt das aktuelle Image als :previous vor jedem Build (Rollback)
#   - kein Force-Removal anderer Container

set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_DIR="$REPO_ROOT/deploy/frontend-vps-deploy-v2"
ENV_FILE="$COMPOSE_DIR/.env"

cd "$COMPOSE_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "FEHLER: $ENV_FILE fehlt. cp .env.example .env und befüllen." >&2
  exit 1
fi

# Mode aus Arg.
MODE="up"
TAIL_LOGS=0
for arg in "$@"; do
  case "$arg" in
    --restart) MODE="restart" ;;
    --logs)    TAIL_LOGS=1 ;;
    -h|--help)
      sed -n '3,18p' "$0"; exit 0 ;;
    *)
      echo "Unbekanntes Argument: $arg" >&2; exit 2 ;;
  esac
done

# Port-Check.
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a
PORT="${FRONTEND_HOST_PORT:-8090}"

if ss -ltn "( sport = :$PORT )" 2>/dev/null | grep -q "LISTEN"; then
  OWNER="$(docker ps --filter "publish=$PORT" --format '{{.Names}}' || true)"
  if [[ "$OWNER" != "realsync-frontend" && -n "$OWNER" ]]; then
    echo "FEHLER: Port $PORT bereits belegt durch Container '$OWNER'." >&2
    exit 3
  fi
  if [[ -z "$OWNER" ]]; then
    echo "WARNUNG: Port $PORT ist von einem Nicht-Docker-Prozess belegt. Trotzdem fortfahren? [y/N]"
    read -r ans
    [[ "$ans" =~ ^[yY]$ ]] || exit 3
  fi
fi

if [[ "$MODE" == "restart" ]]; then
  docker compose --env-file "$ENV_FILE" restart frontend
else
  # Vor dem Build aktuelles Image für Rollback sichern.
  if docker image inspect realsync-frontend:latest >/dev/null 2>&1; then
    docker image tag realsync-frontend:latest realsync-frontend:previous
    echo "→ Rollback-Tag gesetzt: realsync-frontend:previous"
  fi

  docker compose --env-file "$ENV_FILE" up -d --build
  docker image prune -f >/dev/null
fi

# Auf healthy warten — max. 60s.
echo -n "→ warte auf healthy "
for _ in $(seq 1 30); do
  STATUS="$(docker inspect -f '{{.State.Health.Status}}' realsync-frontend 2>/dev/null || echo missing)"
  if [[ "$STATUS" == "healthy" ]]; then
    echo " ok"; break
  fi
  echo -n "."
  sleep 2
done

if [[ "${STATUS:-}" != "healthy" ]]; then
  echo " FEHLGESCHLAGEN — letzter Status: ${STATUS:-unknown}" >&2
  docker compose logs --tail=50 frontend >&2
  exit 4
fi

# Smoke.
if curl -fsS "http://127.0.0.1:$PORT/healthz" >/dev/null; then
  echo "→ /healthz reachable on 127.0.0.1:$PORT"
else
  echo "WARNUNG: /healthz auf 127.0.0.1:$PORT nicht erreichbar." >&2
fi

if [[ "$TAIL_LOGS" == "1" ]]; then
  docker compose logs -f frontend
fi
