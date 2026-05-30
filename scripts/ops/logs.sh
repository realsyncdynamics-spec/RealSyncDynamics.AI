#!/usr/bin/env bash
# scripts/ops/logs.sh
#
# Konsistenter Wrapper für Container-Logs mit sinnvollen Defaults.
# Reine Read-Operation. Kein Restart, kein Mutation.
#
# Usage:
#   bash scripts/ops/logs.sh <container>              # letzte 100 Zeilen
#   bash scripts/ops/logs.sh <container> --follow     # tail -f
#   bash scripts/ops/logs.sh <container> --since 1h   # letzte Stunde
#   bash scripts/ops/logs.sh --list                   # alle Container-Namen
#   bash scripts/ops/logs.sh --errors <container>     # nur ERROR/WARN/FATAL

set -u

if ! command -v docker >/dev/null 2>&1; then
  echo "FEHLER: docker nicht im PATH." >&2
  exit 3
fi
if ! docker info >/dev/null 2>&1; then
  echo "FEHLER: docker-Daemon nicht erreichbar. Auf dem VPS ausführen." >&2
  exit 3
fi

LIST=0
FOLLOW=""
SINCE="--tail 100"
ERRORS_ONLY=0
CONTAINER=""

while [ $# -gt 0 ]; do
  case "$1" in
    --list)    LIST=1; shift ;;
    --follow|-f) FOLLOW="-f"; shift ;;
    --since)   SINCE="--since $2"; shift 2 ;;
    --tail)    SINCE="--tail $2"; shift 2 ;;
    --errors)  ERRORS_ONLY=1; shift ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    -*)        echo "unbekanntes Argument: $1" >&2; exit 2 ;;
    *)         CONTAINER="$1"; shift ;;
  esac
done

if [ "$LIST" = "1" ]; then
  printf 'Laufende Container:\n'
  docker ps --format '  {{.Names}}  ({{.Image}})  {{.Status}}' | sort
  exit 0
fi

if [ -z "$CONTAINER" ]; then
  echo 'FEHLER: Container-Name fehlt. Siehe --help oder --list.' >&2
  exit 2
fi

# Pre-Flight: existiert der Container?
if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
  echo "FEHLER: Container '$CONTAINER' existiert nicht." >&2
  echo "Verfügbare: $(docker ps --format '{{.Names}}' | tr '\n' ' ')" >&2
  exit 3
fi

# Logs holen — Filtern wenn --errors
if [ "$ERRORS_ONLY" = "1" ]; then
  # shellcheck disable=SC2086
  docker logs $SINCE $FOLLOW "$CONTAINER" 2>&1 \
    | grep -E --line-buffered -i 'error|fatal|warn|critical|panic|exception|traceback' \
    | head -200
else
  # shellcheck disable=SC2086
  exec docker logs $SINCE $FOLLOW "$CONTAINER"
fi
