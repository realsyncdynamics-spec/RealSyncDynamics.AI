#!/bin/bash
# scripts/backup.sh — Backup RealSyncDynamics.AI Data
#
# Sichert:
#   - Nutzdaten der Container (Bind-Mounts unter ./data)
#   - Traefik-Zustand (acme.json mit den ausgestellten Zertifikaten)
#   - Konfiguration (.env, docker-compose.yml, traefik/*.yml)
#   - Datenbank (Supabase) — derzeit nicht implementiert, siehe backup_database
#
# WICHTIG: Die Pfade hier müssen zu den Mounts in docker-compose.yml passen.
# Der Stack nutzt Bind-Mounts (./data/<dienst>), keine named volumes — ein
# Backup über `docker volume` würde leere oder gar keine Volumes sichern und
# ein erfolgreiches Backup melden, das keine Nutzdaten enthält.
#
# Usage:
#   ./scripts/backup.sh [project-root]

set -euo pipefail

# Projektwurzel: Standard ist das übergeordnete Verzeichnis dieses Skripts,
# damit der Aufruf aus jedem Arbeitsverzeichnis funktioniert.
PROJECT_ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$PROJECT_ROOT"

# Absolut halten: compress_backup wechselt das Verzeichnis, danach würden
# relative Pfade auf ein Unterverzeichnis von sich selbst zeigen.
BACKUP_ROOT="$(cd "$PROJECT_ROOT" && pwd)/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$BACKUP_ROOT/backup-${TIMESTAMP}"
RETAIN_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# Datenverzeichnisse — Spiegel der Bind-Mounts in docker-compose.yml.
# ./data/hermes enthält ./data/hermes/data (n8n-SQLite) und wird mitgesichert.
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

# Create backup directory
mkdir -p "$BACKUP_DIR"
log_info "Backup directory: $BACKUP_DIR"

# Backup der Container-Nutzdaten (Bind-Mounts)
backup_data() {
  log_info "Backing up container data directories..."

  local found=0

  for dir in "${DATA_DIRS[@]}"; do
    local name
    name=$(basename "$dir")

    if [[ ! -d "$dir" ]]; then
      log_warn "✗ Data directory not found: $dir"
      continue
    fi

    log_info "Backing up: $dir"
    # --numeric-owner: die Container laufen unter eigenen UIDs (z.B. n8n als
    # 1000). Namensauflösung auf dem Host würde beim Restore fremde Konten
    # treffen.
    tar czpf "$BACKUP_DIR/${name}-${TIMESTAMP}.tar.gz" \
      --numeric-owner -C "$PROJECT_ROOT" "$dir"
    found=$((found + 1))
    log_info "✓ $dir backed up"
  done

  if [[ $found -eq 0 ]]; then
    log_error "Kein einziges Datenverzeichnis gefunden — Backup wäre leer."
    return 1
  fi
}

# Backup configuration
backup_config() {
  log_info "Backing up configuration files..."

  mkdir -p "$BACKUP_DIR/config"
  cp .env "$BACKUP_DIR/config/" 2>/dev/null || log_warn "No .env file found"
  cp docker-compose.yml "$BACKUP_DIR/config/" 2>/dev/null || true
  cp traefik/*.yml "$BACKUP_DIR/config/" 2>/dev/null || true

  # acme.json enthält die ausgestellten Let's-Encrypt-Zertifikate. Ohne sie
  # fordert Traefik nach einem Restore alles neu an und läuft dabei in die
  # Rate-Limits von Let's Encrypt.
  if [[ -f traefik/acme.json ]]; then
    cp traefik/acme.json "$BACKUP_DIR/config/"
    chmod 600 "$BACKUP_DIR/config/acme.json"
    log_info "✓ traefik/acme.json backed up"
  else
    log_warn "No traefik/acme.json found"
  fi

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
  # Unterverzeichnisname bleibt im Archiv erhalten (backup-TIMESTAMP/...),
  # restore.sh setzt genau darauf auf.
  tar czf "$BACKUP_ROOT/backup-${TIMESTAMP}.tar.gz" \
    -C "$BACKUP_ROOT" "backup-${TIMESTAMP}"
  rm -rf "$BACKUP_DIR"
  log_info "✓ Backup compressed: $BACKUP_ROOT/backup-${TIMESTAMP}.tar.gz"
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

  find "$BACKUP_ROOT" -maxdepth 1 -name "backup-*.tar.gz" -type f -mtime "+$RETAIN_DAYS" -delete

  log_info "✓ Old backups cleaned up"
}

# Main backup flow
main() {
  log_info "=========================================="
  log_info "RealSyncDynamics.AI Backup"
  log_info "Timestamp: $TIMESTAMP"
  log_info "Project root: $PROJECT_ROOT"
  log_info "=========================================="

  # Kein `|| log_error`: ein Backup ohne Nutzdaten darf nicht als Erfolg
  # durchgehen — sonst fällt der Defekt erst beim Restore auf.
  backup_data || { log_error "Data backup failed"; exit 1; }
  backup_config || { log_error "Config backup failed"; exit 1; }
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
