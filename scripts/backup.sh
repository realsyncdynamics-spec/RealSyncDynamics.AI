#!/bin/bash
# scripts/backup.sh — Backup RealSyncDynamics.AI Data
#
# Creates backups of:
#   - Database (Supabase)
#   - Container volumes (Ollama, Hermes, AnythingLLM)
#   - Configuration files
#
# Usage:
#   ./scripts/backup.sh [backup-dir]

set -euo pipefail

BACKUP_ROOT="${1:-.}/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$BACKUP_ROOT/backup-${TIMESTAMP}"
RETAIN_DAYS="${BACKUP_RETENTION_DAYS:-30}"

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

# Create backup directory
mkdir -p "$BACKUP_DIR"
log_info "Backup directory: $BACKUP_DIR"

# Backup volumes
backup_volumes() {
  log_info "Backing up Docker volumes..."

  declare -a volumes=("ollama_data" "hermes_data" "anythingllm_data" "uptime_kuma_data")

  for volume in "${volumes[@]}"; do
    log_info "Backing up volume: $volume"
    if docker volume ls | grep -q "$volume"; then
      docker run --rm \
        -v "$volume":/data \
        -v "$BACKUP_DIR":/backup \
        alpine tar czf "/backup/${volume}-${TIMESTAMP}.tar.gz" -C / data/
      log_info "✓ Volume $volume backed up"
    else
      log_warn "✗ Volume $volume not found"
    fi
  done
}

# Backup configuration
backup_config() {
  log_info "Backing up configuration files..."

  # Copy important config files
  mkdir -p "$BACKUP_DIR/config"
  cp .env "$BACKUP_DIR/config/" 2>/dev/null || log_warn "No .env file found"
  cp docker-compose.yml "$BACKUP_DIR/config/" 2>/dev/null || true
  cp traefik/*.yml "$BACKUP_DIR/config/" 2>/dev/null || true

  log_info "✓ Configuration backed up"
}

# Backup Supabase database
backup_database() {
  log_info "Backing up Supabase database..."

  if command -v supabase &> /dev/null; then
    mkdir -p "$BACKUP_DIR/database"
    # TODO: Implement Supabase backup (via API or local dump)
    # For now, this is a placeholder
    log_warn "Supabase backup not yet implemented"
  else
    log_warn "supabase CLI not found, skipping database backup"
  fi
}

# Compress backup
compress_backup() {
  log_info "Compressing backup..."
  cd "$BACKUP_ROOT"
  tar czf "backup-${TIMESTAMP}.tar.gz" "backup-${TIMESTAMP}/"
  rm -rf "backup-${TIMESTAMP}/"
  log_info "✓ Backup compressed: backup-${TIMESTAMP}.tar.gz"
}

# Upload to S3 (optional)
upload_to_s3() {
  if [[ -z "${S3_BUCKET:-}" ]]; then
    log_warn "S3_BUCKET not set, skipping S3 upload"
    return
  fi

  log_info "Uploading backup to S3..."

  if command -v aws &> /dev/null; then
    aws s3 cp "$BACKUP_ROOT/backup-${TIMESTAMP}.tar.gz" \
      "s3://${S3_BUCKET}/backups/backup-${TIMESTAMP}.tar.gz" \
      --region "${S3_REGION:-eu-west-1}"
    log_info "✓ Backup uploaded to S3"
  else
    log_warn "AWS CLI not found, skipping S3 upload"
  fi
}

# Cleanup old backups
cleanup_old_backups() {
  log_info "Cleaning up backups older than $RETAIN_DAYS days..."

  find "$BACKUP_ROOT" -name "backup-*.tar.gz" -type f -mtime "+$RETAIN_DAYS" -delete

  log_info "✓ Old backups cleaned up"
}

# Main backup flow
main() {
  log_info "=========================================="
  log_info "RealSyncDynamics.AI Backup"
  log_info "Timestamp: $TIMESTAMP"
  log_info "=========================================="

  backup_volumes || log_error "Volume backup failed"
  backup_config || log_error "Config backup failed"
  backup_database || log_warn "Database backup warning"
  compress_backup || { log_error "Compression failed"; exit 1; }
  upload_to_s3 || log_warn "S3 upload warning"
  cleanup_old_backups || log_warn "Cleanup warning"

  log_info "=========================================="
  log_info "✓ Backup completed successfully!"
  log_info "Location: $BACKUP_ROOT/backup-${TIMESTAMP}.tar.gz"
  log_info "=========================================="
}

# Run main
main "$@"
