#!/bin/bash
# scripts/healthcheck.sh — Comprehensive Health Check for RealSyncDynamics.AI
#
# Checks:
#   - Docker containers running
#   - HTTP endpoints responding
#   - Database connectivity
#   - Disk space
#   - Log file sizes
#
# Usage:
#   ./scripts/healthcheck.sh [--send-alert]

set -euo pipefail

SEND_ALERT="${1:-}"
DOMAIN="${DOMAIN:-realsyncdynamicsai.de}"
ALERT_EMAIL="${WATCHTOWER_EMAIL_TO:-}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

HEALTH_STATUS=0  # 0 = all good, 1 = warnings, 2 = errors

log_info() {
  echo -e "${GREEN}[✓]${NC} $*"
}

log_warn() {
  echo -e "${YELLOW}[⚠]${NC} $*"
  HEALTH_STATUS=$((HEALTH_STATUS > 1 ? HEALTH_STATUS : 1))
}

log_error() {
  echo -e "${RED}[✗]${NC} $*"
  HEALTH_STATUS=2
}

# Check containers
check_containers() {
  echo "=== Container Status ==="

  declare -a services=("traefik" "frontend" "ollama" "hermes" "anythingllm" "uptime-kuma" "watchtower")

  for service in "${services[@]}"; do
    if docker ps | grep -q "realsync-$service"; then
      log_info "Service $service is running"
    else
      log_warn "Service $service is NOT running"
    fi
  done
}

# Check HTTP endpoints
check_endpoints() {
  echo ""
  echo "=== HTTP Endpoints ==="

  local -A endpoints=(
    ["Frontend"]="https://$DOMAIN/healthz"
    ["Ollama"]="http://localhost:11434/api/tags"
    ["Hermes"]="http://localhost:5678/api/v1/health"
    ["AnythingLLM"]="http://localhost:3001/api/health"
  )

  for name in "${!endpoints[@]}"; do
    local url="${endpoints[$name]}"
    if curl -sf "$url" &> /dev/null; then
      log_info "$name endpoint responding"
    else
      log_warn "$name endpoint not responding: $url"
    fi
  done
}

# Check disk space
check_disk_space() {
  echo ""
  echo "=== Disk Space ==="

  local available=$(df / | awk 'NR==2 {print $4}')
  local threshold=$((1024 * 1024))  # 1GB in KB

  if [ "$available" -lt "$threshold" ]; then
    log_error "Low disk space: $(numfmt --to=iec-i --suffix=B $((available * 1024)))"
  else
    log_info "Disk space: $(numfmt --to=iec-i --suffix=B $((available * 1024))) available"
  fi
}

# Check container resource usage
check_resources() {
  echo ""
  echo "=== Resource Usage ==="

  docker ps --format "table {{.Names}}\t{{.CPUPerc}}\t{{.MemUsage}}" | tail -n +2 | while read line; do
    if [[ ! -z "$line" ]]; then
      log_info "$(echo $line | awk '{printf "%s: CPU %s, Memory %s\n", $1, $2, $3}')"
    fi
  done
}

# Check logs for errors
check_logs() {
  echo ""
  echo "=== Recent Errors (Last 5 minutes) ==="

  local cutoff=$(date -d '5 minutes ago' +%s)

  # Check docker daemon logs
  if journalctl -u docker -S "5 minutes ago" 2>/dev/null | grep -i "error\|critical\|panic" | head -5; then
    log_warn "Errors found in docker logs"
  else
    log_info "No recent docker errors"
  fi

  # Check Sentry (if configured)
  # TODO: Implement Sentry health check API call
}

# Check database connectivity
check_database() {
  echo ""
  echo "=== Database Connectivity ==="

  if [[ -z "${VITE_SUPABASE_URL:-}" ]]; then
    log_warn "VITE_SUPABASE_URL not configured"
    return
  fi

  if curl -sf "${VITE_SUPABASE_URL}/rest/v1/health" -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" &> /dev/null; then
    log_info "Database connectivity OK"
  else
    log_warn "Database connectivity check failed"
  fi
}

# Check data directory sizes
# Der Stack nutzt Bind-Mounts (./data/<dienst>), keine named volumes — eine
# Abfrage über `docker volume` liefe ins Leere.
check_data_sizes() {
  echo ""
  echo "=== Data Directory Sizes ==="

  declare -a data_dirs=("data/ollama" "data/hermes" "data/anythingllm" "data/uptime-kuma")

  for dir in "${data_dirs[@]}"; do
    if [[ -d "$dir" ]]; then
      local size
      size=$(du -sh "$dir" 2>/dev/null | cut -f1)
      log_info "$dir: $size"
    else
      log_warn "$dir: nicht vorhanden"
    fi
  done
}

# Check TLS certificates
check_certificates() {
  echo ""
  echo "=== TLS Certificates ==="

  if [[ -f "./traefik/acme.json" ]]; then
    # Check cert expiry
    local cert_expiry=$(docker run --rm -v ./traefik:/certs alpine \
      openssl x509 -in /certs/acme.json -text -noout 2>/dev/null | grep -oP 'Not After : \K.*' || echo "Unknown")
    if [[ -z "$cert_expiry" || "$cert_expiry" == "Unknown" ]]; then
      log_warn "Could not read certificate expiry from acme.json"
    else
      log_info "Certificate expiry: $cert_expiry"
    fi
  else
    log_warn "acme.json not found"
  fi
}

# Generate alert
send_alert() {
  if [[ "$HEALTH_STATUS" -eq 0 ]] || [[ -z "$SEND_ALERT" ]]; then
    return
  fi

  if [[ -z "$ALERT_EMAIL" ]]; then
    log_warn "WATCHTOWER_EMAIL_TO not configured, skipping alert"
    return
  fi

  log_warn "Sending health check alert to $ALERT_EMAIL"

  # TODO: Implement email alert via mail command or webhook
}

# Main
main() {
  echo ""
  echo "=========================================="
  echo "RealSyncDynamics.AI Health Check"
  echo "Timestamp: $(date +'%Y-%m-%d %H:%M:%S')"
  echo "=========================================="
  echo ""

  check_containers
  check_endpoints
  check_disk_space
  check_resources
  check_data_sizes
  check_certificates
  check_database
  check_logs

  echo ""
  echo "=========================================="
  if [ "$HEALTH_STATUS" -eq 0 ]; then
    log_info "All systems operational"
  elif [ "$HEALTH_STATUS" -eq 1 ]; then
    log_warn "System has warnings - check above"
  else
    log_error "System has critical issues - immediate action required"
  fi
  echo "=========================================="
  echo ""

  send_alert

  exit "$HEALTH_STATUS"
}

main "$@"
