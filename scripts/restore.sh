#!/bin/bash
# scripts/restore.sh — Restore RealSyncDynamics.AI from Backup
#
# Gegenstück zu scripts/backup.sh. Stellt die Bind-Mounts unter ./data sowie
# die Konfiguration wieder her — dieselben Pfade, die docker-compose.yml
# tatsächlich mountet.
#
# Als root bzw. mit sudo ausführen: die Archive tragen die numerischen UIDs
# der Container-Prozesse, die sonst nicht gesetzt werden können.
#
# Usage:
#   ./scripts/restore.sh backups/backup-20260726_120000.tar.gz

set -euo pipefail

BACKUP_FILE="${1:-}"
PROJECT_ROOT="${RESTORE_PATH:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
TEMP_DIR=""

# Muss zu DATA_DIRS in backup.sh passen.
declare -a DATA_DIRS=(
  "data/ollama"
  "data/hermes"
  "data/anythingllm"
  "data/uptime-kuma"
)

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

log_info() {
  echo -e "${GREEN}[INFO]${NC} $*"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $*"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $*"
}

# Docker Compose v1 und v2 unterstützen
compose() {
  if docker compose version &> /dev/null; then
    docker compose "$@"
  else
    docker-compose "$@"
  fi
}

# Validation
validate_backup() {
  if [[ -z "$BACKUP_FILE" ]]; then
    log_error "Usage: $0 backups/backup-YYYYMMDD_HHMMSS.tar.gz"
    exit 1
  fi

  if [[ ! -f "$BACKUP_FILE" ]]; then
    log_error "Backup file not found: $BACKUP_FILE"
    exit 1
  fi

  if ! tar tzf "$BACKUP_FILE" &> /dev/null; then
    log_error "Invalid backup file (not a valid tar.gz)"
    exit 1
  fi

  log_info "✓ Backup file validated"
}

# Stop containers
stop_containers() {
  log_info "Stopping containers..."
  compose down || log_warn "Some containers may not have stopped cleanly"
  sleep 2
  log_info "✓ Containers stopped"
}

# Extract backup
# Setzt TEMP_DIR. Bewusst keine Rückgabe über stdout: die log_*-Ausgaben
# landen sonst in der Kommandosubstitution und verfälschen den Pfad.
extract_backup() {
  TEMP_DIR="$PROJECT_ROOT/.restore-temp-${TIMESTAMP}"
  mkdir -p "$TEMP_DIR"

  log_info "Extracting backup..."
  tar xzf "$BACKUP_FILE" -C "$TEMP_DIR"

  # Das Archiv enthält genau ein Verzeichnis backup-<timestamp>/
  local inner
  inner=$(find "$TEMP_DIR" -maxdepth 1 -mindepth 1 -type d -name 'backup-*' | head -n1)
  if [[ -z "$inner" ]]; then
    log_error "Unerwartetes Archivformat: kein backup-*/ Verzeichnis gefunden"
    return 1
  fi
  TEMP_DIR="$inner"

  log_info "✓ Backup extracted to $TEMP_DIR"
}

# Restore der Bind-Mounts
restore_data() {
  log_info "Restoring container data directories..."

  local restored=0

  for dir in "${DATA_DIRS[@]}"; do
    local name
    name=$(basename "$dir")

    local archive
    archive=$(find "$TEMP_DIR" -maxdepth 1 -name "${name}-*.tar.gz" | head -n1)

    if [[ -z "$archive" ]]; then
      log_warn "✗ Kein Archiv im Backup für: $dir"
      continue
    fi

    log_info "Restoring: $dir"
    # Altbestand beiseitelegen statt löschen — ein fehlgeschlagener Restore
    # soll nicht auch noch den vorherigen Stand vernichten.
    if [[ -d "$PROJECT_ROOT/$dir" ]]; then
      mv "$PROJECT_ROOT/$dir" "$PROJECT_ROOT/${dir}.pre-restore-${TIMESTAMP}"
    fi
    mkdir -p "$(dirname "$PROJECT_ROOT/$dir")"
    tar xzpf "$archive" --numeric-owner -C "$PROJECT_ROOT"
    restored=$((restored + 1))
    log_info "✓ $dir restored"
  done

  if [[ $restored -eq 0 ]]; then
    log_error "Kein einziges Datenverzeichnis wiederhergestellt."
    return 1
  fi
}

# Restore configuration
restore_config() {
  log_info "Restoring configuration files..."

  local config_dir="$TEMP_DIR/config"
  if [[ ! -d "$config_dir" ]]; then
    log_warn "✗ Configuration backup not found"
    return 0
  fi

  # Aktuellen Stand sichern
  local keep="$PROJECT_ROOT/config-backup-${TIMESTAMP}"
  mkdir -p "$keep"
  cp "$PROJECT_ROOT/.env" "$keep/" 2>/dev/null || true
  cp "$PROJECT_ROOT/docker-compose.yml" "$keep/" 2>/dev/null || true
  cp "$PROJECT_ROOT/traefik/acme.json" "$keep/" 2>/dev/null || true

  cp "$config_dir/.env" "$PROJECT_ROOT/" 2>/dev/null || log_warn "No .env in backup"
  cp "$config_dir/docker-compose.yml" "$PROJECT_ROOT/" 2>/dev/null \
    || log_warn "No docker-compose.yml in backup"

  if [[ -f "$config_dir/acme.json" ]]; then
    mkdir -p "$PROJECT_ROOT/traefik"
    cp "$config_dir/acme.json" "$PROJECT_ROOT/traefik/acme.json"
    # Traefik verweigert den Start, wenn acme.json weiter offen steht.
    chmod 600 "$PROJECT_ROOT/traefik/acme.json"
    log_info "✓ traefik/acme.json restored"
  else
    log_warn "No acme.json in backup — Traefik fordert Zertifikate neu an"
  fi

  log_info "✓ Configuration restored"
}

# Start containers
start_containers() {
  log_info "Starting containers..."
  compose up -d --remove-orphans
  sleep 5
  log_info "✓ Containers started"
}

# Health checks
verify_restore() {
  log_info "Verifying restore..."

  local max_retries=30
  local retry_count=0

  while [ $retry_count -lt $max_retries ]; do
    if docker ps | grep -q "realsync-frontend"; then
      log_info "✓ Restore verified - containers are running"
      return 0
    fi
    retry_count=$((retry_count + 1))
    sleep 1
  done

  log_error "✗ Restore verification failed - containers not running"
  return 1
}

# Cleanup
cleanup() {
  [[ -z "$TEMP_DIR" ]] && return 0
  log_info "Cleaning up temporary files..."
  # Das Elternverzeichnis entfernen — TEMP_DIR zeigt nach extract_backup auf
  # das innere backup-*/ Verzeichnis.
  rm -rf "$(dirname "$TEMP_DIR")"
  log_info "✓ Cleanup completed"
}

# Main restore flow
main() {
  log_info "=========================================="
  log_info "RealSyncDynamics.AI Restore"
  log_info "Backup file: $BACKUP_FILE"
  log_info "Project root: $PROJECT_ROOT"
  log_info "=========================================="

  validate_backup
  # Ab hier immer aufräumen, auch bei Abbruch.
  trap cleanup EXIT

  stop_containers || exit 1
  extract_backup || exit 1
  restore_data || { log_error "Data restore failed"; exit 1; }
  restore_config || log_warn "Config restore had issues"
  start_containers || exit 1
  verify_restore || exit 1

  log_info "=========================================="
  log_info "✓ Restore completed successfully!"
  log_info "Vorheriger Stand liegt unter: config-backup-${TIMESTAMP}"
  log_info "und data/<dienst>.pre-restore-${TIMESTAMP}"
  log_info "=========================================="
}

# Run main
main "$@"
