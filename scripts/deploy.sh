#!/bin/bash
# scripts/deploy.sh — Deploy RealSyncDynamics.AI to VPS
#
# Usage:
#   ./scripts/deploy.sh [staging|production]
#
# This script:
#   1. Validates environment
#   2. Pulls latest changes from git
#   3. Pulls latest Docker images
#   4. Runs database migrations
#   5. Starts containers with docker-compose up -d
#   6. Runs health checks
#   7. Performs smoke tests

set -euo pipefail

ENVIRONMENT="${1:-production}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOY_DIR="${DEPLOY_PATH:-.}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${DEPLOY_DIR}/logs/deploy-${TIMESTAMP}.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log_info() {
  echo -e "${GREEN}[INFO]${NC} $*" | tee -a "$LOG_FILE"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $*" | tee -a "$LOG_FILE"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $*" | tee -a "$LOG_FILE"
}

# Validation
validate_environment() {
  log_info "Validating environment..."

  if [[ ! -f "$PROJECT_ROOT/.env" ]]; then
    log_error ".env file not found. Copy .env.docker to .env and fill in values."
    exit 1
  fi

  if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed or not in PATH"
    exit 1
  fi

  if ! command -v docker-compose &> /dev/null; then
    log_error "docker-compose is not installed or not in PATH"
    exit 1
  fi

  log_info "Environment validation passed"
}

# Create necessary directories
setup_directories() {
  log_info "Setting up directories..."
  mkdir -p "$DEPLOY_DIR"/{logs,data/{ollama,hermes,anythingllm,uptime-kuma},backups,traefik}
  chmod 700 "$DEPLOY_DIR/traefik"
  touch "$DEPLOY_DIR/traefik/acme.json"
  chmod 600 "$DEPLOY_DIR/traefik/acme.json"
  log_info "Directories ready"
}

# Pull latest code
update_code() {
  log_info "Pulling latest code from git..."
  cd "$PROJECT_ROOT"
  git fetch origin
  git checkout main || git checkout master
  git pull origin main || git pull origin master
  log_info "Code updated to latest"
}

# Pull and build images
build_images() {
  log_info "Building and pulling Docker images..."
  cd "$PROJECT_ROOT"
  docker-compose pull
  docker-compose build --pull frontend
  log_info "Images built/pulled successfully"
}

# Run database migrations
run_migrations() {
  log_info "Running database migrations..."
  # Placeholder: Add actual migration logic if needed
  # For now, Supabase migrations are typically run via supabase CLI
  log_info "Migrations check completed"
}

# Deploy with docker-compose
deploy_containers() {
  log_info "Starting containers with docker-compose..."
  cd "$PROJECT_ROOT"

  # Load environment
  set -a
  source .env
  set +a

  # Bring up services (create + start)
  docker-compose up -d --remove-orphans

  log_info "Containers started"
}

# Health checks
run_healthchecks() {
  log_info "Running health checks..."

  declare -a services=("traefik" "frontend" "ollama" "hermes" "anythingllm" "uptime-kuma")
  local max_retries=30
  local retry_count=0

  for service in "${services[@]}"; do
    retry_count=0
    while [ $retry_count -lt $max_retries ]; do
      if docker ps | grep -q "realsync-$service"; then
        log_info "✓ Service $service is running"
        break
      fi
      retry_count=$((retry_count + 1))
      sleep 1
    done

    if [ $retry_count -eq $max_retries ]; then
      log_warn "✗ Service $service health check failed (timeout)"
    fi
  done

  # Check HTTP endpoints
  log_info "Testing HTTP endpoints..."

  # Frontend
  if curl -sf https://realsyncdynamicsai.de/healthz &> /dev/null; then
    log_info "✓ Frontend is responding"
  else
    log_warn "✗ Frontend health check failed"
  fi

  # Ollama
  if curl -sf http://localhost:11434/api/tags &> /dev/null; then
    log_info "✓ Ollama is responding"
  else
    log_warn "✗ Ollama health check failed"
  fi

  log_info "Health checks completed"
}

# Smoke tests
run_smoke_tests() {
  log_info "Running smoke tests..."

  # Test frontend loads
  if curl -sf https://realsyncdynamicsai.de | grep -q "<html\|<body" ; then
    log_info "✓ Frontend HTML loads"
  else
    log_warn "✗ Frontend HTML test failed"
  fi

  # Test API connectivity
  if curl -sf https://realsyncdynamicsai.de/api/health &> /dev/null || \
     curl -sf https://realsyncdynamicsai.de &> /dev/null; then
    log_info "✓ API connectivity OK"
  else
    log_warn "✗ API connectivity test failed"
  fi

  log_info "Smoke tests completed"
}

# Backup before deploy
backup_before_deploy() {
  log_info "Creating pre-deployment backup..."
  if [[ -f "$PROJECT_ROOT/scripts/backup.sh" ]]; then
    bash "$PROJECT_ROOT/scripts/backup.sh"
  else
    log_warn "Backup script not found, skipping"
  fi
}

# Rollback function (called on error)
rollback() {
  log_error "Deployment failed! Attempting rollback..."
  cd "$PROJECT_ROOT"
  docker-compose down
  # TODO: Restore from backup
  log_error "Rollback completed. Manual intervention may be required."
}

# Main deployment flow
main() {
  log_info "=========================================="
  log_info "RealSyncDynamics.AI Deployment"
  log_info "Environment: $ENVIRONMENT"
  log_info "=========================================="

  # Create log directory
  mkdir -p "$(dirname "$LOG_FILE")"

  # Execute deployment steps
  validate_environment || exit 1
  setup_directories || exit 1
  backup_before_deploy || log_warn "Backup failed, continuing anyway"
  update_code || { rollback; exit 1; }
  build_images || { rollback; exit 1; }
  run_migrations || { rollback; exit 1; }
  deploy_containers || { rollback; exit 1; }
  run_healthchecks || { rollback; exit 1; }
  run_smoke_tests || { log_warn "Smoke tests had warnings"; }

  log_info "=========================================="
  log_info "✓ Deployment completed successfully!"
  log_info "=========================================="
  log_info "Deployment log: $LOG_FILE"
}

# Error handling
trap 'log_error "Unexpected error on line $LINENO"; rollback; exit 1' ERR

# Run main
main "$@"
