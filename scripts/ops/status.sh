#!/usr/bin/env bash
# scripts/ops/status.sh
#
# Schneller Read-Only-Status: was läuft, was hört, was antwortet.
# Für tägliche Checks. Detaillierte Diagnose: scripts/ops/doctor.sh
#
# Usage:
#   bash scripts/ops/status.sh

set -u

if ! command -v docker >/dev/null 2>&1; then
  echo "FEHLER: docker nicht im PATH." >&2
  exit 3
fi
if ! docker info >/dev/null 2>&1; then
  echo "FEHLER: docker-Daemon nicht erreichbar. Auf dem VPS ausführen." >&2
  exit 3
fi

APEX_DOMAIN="${APEX_DOMAIN:-realsyncdynamicsai.de}"

printf '════ RealSync Quick-Status · %s ════\n\n' "$(date -u +%FT%TZ)"

# 1. Container-Counts
printf 'Container:\n'
RUNNING=$(docker ps -q | wc -l)
ALL=$(docker ps -aq | wc -l)
UNHEALTHY=$(docker ps --filter health=unhealthy -q | wc -l)
RESTARTING=$(docker ps --filter status=restarting -q | wc -l)
printf '  running=%s  total=%s  unhealthy=%s  restarting=%s\n' \
  "$RUNNING" "$ALL" "$UNHEALTHY" "$RESTARTING"

if [ "$UNHEALTHY" -gt 0 ]; then
  printf '\n⚠ unhealthy:\n'
  docker ps --filter health=unhealthy --format '  {{.Names}}  ({{.Status}})'
fi
if [ "$RESTARTING" -gt 0 ]; then
  printf '\n⚠ restarting:\n'
  docker ps --filter status=restarting --format '  {{.Names}}  ({{.Status}})'
fi

# 2. RealSync-relevante Container
printf '\nRealSync-relevant:\n'
for name in kodee-ollama kodee-open-webui kodee-n8n realsync-frontend \
            realsync-agent-runtime openclaw-app-1; do
  state=$(docker inspect -f '{{.State.Status}} ({{if .State.Health}}{{.State.Health.Status}}{{else}}no-hc{{end}})' \
    "$name" 2>/dev/null || echo 'absent')
  printf '  %-25s %s\n' "$name" "$state"
done

# 3. Listener auf bekannten Ports
printf '\nListener auf relevanten Ports:\n'
if command -v ss >/dev/null 2>&1; then
  ss -ltn 2>/dev/null | awk '
    NR==1 { print "  " $0; next }
    $4 ~ /:(80|443|3000|5678|8080|8090|8787|11434|5432)$/ { print "  " $0 }
  ' | head -15
else
  echo '  (ss nicht verfügbar)'
fi

# 4. Public-Endpoint Smoke
printf '\nPublic Endpoints (HTTP-Code):\n'
for sub in '' www. ollama. chat. n8n.; do
  url="https://${sub}${APEX_DOMAIN}/"
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 -L "$url" 2>/dev/null || echo '---')
  printf '  %-45s %s\n' "$url" "$code"
done

# 5. Disk-Headroom
printf '\nDisk / Memory:\n'
df -h / 2>/dev/null | awk 'NR==2 {printf "  root: used=%s/%s (%s)\n", $3, $2, $5}'
free -h 2>/dev/null | awk '/^Mem:/ {printf "  mem:  used=%s/%s\n", $3, $2}'

printf '\n──── ENDE ────\n'
