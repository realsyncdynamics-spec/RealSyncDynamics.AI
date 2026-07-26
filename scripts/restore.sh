#!/bin/bash
# scripts/restore.sh — Restore RealSyncDynamics.AI from Backup
#
# Usage:
#   ./scripts/restore.sh backup-20260726_120000.tar.gz

set -euo pipefail

BACKUP_FILE="${1:-}"
RESTORE_DIR="${RESTORE_PATH:-.}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

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

# Validation
validate_backup() {
  if [[ -z "$BACKUP_FILE" ]]; then
    log_error "Usage: $0 backup-YYYYMMDD_HHMMSS.tar.gz"
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
  docker-compose down || log_warn "Some containers may not have stopped cleanly"
  sleep 2
  log_info "✓ Containers stopped"
}

# Extract backup
extract_backup() {
  local temp_dir="$RESTORE_DIR/.restore-temp"
  mkdir -p "$temp_dir"

  log_info "Extracting backup..."
  tar xzf "$BACKUP_FILE" -C "$temp_dir"

  log_info "✓ Backup extracted to $temp_dir"
  echo "$temp_dir"  # Return temp directory for next step
}

# Restore volumes
restore_volumes() {
  local temp_dir=$1
  log_info "Restoring volumes..."

  # Stop containers first
  docker-compose down

  # Remove old volumes
  docker volume rm ollama_data hermes_data anythingllm_data uptime_kuma_data 2>/dev/null || true

  # Restore from backup
  declare -a volumes=("ollama_data" "hermes_data" "anythingllm_data" "uptime_kuma_data")

  for volume in "${volumes[@]}"; do
    local backup_file="$temp_dir/backup-*/data/${volume}-*.tar.gz"
    if ls $backup_file &>/dev/null; then
      log_info "Restoring volume: $volume"
      docker run --rm \
        -v "$volume":/data \
        -v "$temp_dir":/restore \
        alpine tar xzf "/restore/backup-*/data/${volume}-"*.tar.gz -C /
      log_info "✓ Volume $volume restored"
    else
      log_warn "✗ Volume backup not found: $volume"
    fi
  done
}

# Restore configuration
restore_config() {
  local temp_dir=$1
  log_info "Restoring configuration files..."

  # Backup current config
  mkdir -p "$RESTORE_DIR/config-backup-${TIMESTAMP}"
  cp .env "$RESTORE_DIR/config-backup-${TIMESTAMP}/" 2>/dev/null || true
  cp docker-compose.yml "$RESTORE_DIR/config-backup-${TIMESTAMP}/" 2>/dev/null || true

  # Restore from backup
  if [[ -d "$temp_dir/backup-"/config ]]; then
    cp "$temp_dir/backup-"/config/.env . 2>/dev/null || log_warn "No .env in backup"
    cp "$temp_dir/backup-"/config/docker-compose.yml . 2>/dev/null || log_warn "No docker-compose.yml in backup"
    log_info "✓ Configuration restored"
  else
    log_warn "✗ Configuration backup not found"
  fi
}

# Start containers
start_containers() {
  log_info "Starting containers..."
  docker-compose up -d --remove-orphans
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
  local temp_dir=$1
  log_info "Cleaning up temporary files..."
  rm -rf "$temp_dir"
  log_info "✓ Cleanup completed"
}

# Main restore flow
main() {
  log_info "=========================================="
  log_info "RealSyncDynamics.AI Restore"
  log_info "Backup file: $BACKUP_FILE"
  log_info "=========================================="

  validate_backup || exit 1
  stop_containers || exit 1
  local temp_dir
  temp_dir=$(extract_backup) || exit 1
  restore_volumes "$temp_dir" || { log_error "Volume restore failed"; cleanup "$temp_dir"; exit 1; }
  restore_config "$temp_dir" || log_warn "Config restore had issues"
  start_containers || { cleanup "$temp_dir"; exit 1; }
  verify_restore || { cleanup "$temp_dir"; exit 1; }
  cleanup "$temp_dir" || log_warn "Cleanup warning"

  log_info "=========================================="
  log_info "✓ Restore completed successfully!"
  log_info "Old config backed up to: config-backup-${TIMESTAMP}"
  log_info "=========================================="
}

# Run main
main "$@"
