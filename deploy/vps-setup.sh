#!/bin/bash

################################################################################
# VPS Frontend Deployment Setup Script
#
# Prepares the VPS for automated Docker-based frontend deployment.
# Run as: bash vps-setup.sh
#
# This script:
# - Creates deployment directory structure
# - Verifies Docker & Docker Compose installation
# - Creates .env file from GitHub Secrets
# - Sets up necessary permissions
# - Performs initial health check
################################################################################

set -Eeuo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_PATH="/var/www/realsyncdynamicsai-frontend"
COMPOSE_DIR="$REPO_PATH/deploy/frontend-vps-deploy-v2"
ENV_FILE="$COMPOSE_DIR/.env"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Check if running as root or with sudo
if [[ $EUID -ne 0 ]]; then
  echo -e "${RED}❌ This script must be run as root or with sudo${NC}"
  exit 1
fi

echo -e "${BLUE}🚀 VPS Frontend Deployment Setup${NC}"
echo -e "${BLUE}Timestamp: ${TIMESTAMP}${NC}"
echo ""

################################################################################
# Phase 1: Environment Check
################################################################################

echo -e "${YELLOW}📋 Phase 1: Environment Check${NC}"
echo ""

# Check OS
echo "Checking OS..."
if [[ -f /etc/os-release ]]; then
  . /etc/os-release
  echo -e "${GREEN}✅ OS: $PRETTY_NAME${NC}"
else
  echo -e "${RED}❌ Could not detect OS${NC}"
  exit 1
fi

# Check Docker
echo "Checking Docker..."
if ! command -v docker &> /dev/null; then
  echo -e "${RED}❌ Docker not installed. Install with:${NC}"
  echo "   curl -fsSL https://get.docker.com -o get-docker.sh && bash get-docker.sh"
  exit 1
fi
DOCKER_VERSION=$(docker --version | grep -oP 'version \K[^,]*')
echo -e "${GREEN}✅ Docker ${DOCKER_VERSION}${NC}"

# Check Docker Compose V2
echo "Checking Docker Compose..."
if ! docker compose version &> /dev/null; then
  echo -e "${RED}❌ Docker Compose V2 plugin not found. Install with:${NC}"
  echo "   apt-get update && apt-get install -y docker-compose-plugin"
  exit 1
fi
COMPOSE_VERSION=$(docker compose version | grep -oP 'version \K[^,]*')
echo -e "${GREEN}✅ Docker Compose ${COMPOSE_VERSION}${NC}"

# Check Docker daemon
echo "Checking Docker daemon..."
if ! docker ps &> /dev/null; then
  echo -e "${RED}❌ Docker daemon not responding. Try:${NC}"
  echo "   systemctl start docker"
  exit 1
fi
echo -e "${GREEN}✅ Docker daemon running${NC}"

# Check available disk space
echo "Checking disk space..."
DISK_AVAILABLE=$(df /var/www | awk 'NR==2 {print $4}')
if [[ $DISK_AVAILABLE -lt 5242880 ]]; then  # 5GB
  echo -e "${YELLOW}⚠️  Warning: Less than 5GB disk space available${NC}"
else
  echo -e "${GREEN}✅ Disk space: $(numfmt --to=iec $DISK_AVAILABLE 2>/dev/null || echo "$DISK_AVAILABLE KB")${NC}"
fi

echo ""

################################################################################
# Phase 2: Directory Setup
################################################################################

echo -e "${YELLOW}📂 Phase 2: Directory Setup${NC}"
echo ""

echo "Creating deployment directory: $REPO_PATH"
mkdir -p "$REPO_PATH"
echo -e "${GREEN}✅ Directory created${NC}"

echo ""

################################################################################
# Phase 3: Repository & .env Setup
################################################################################

echo -e "${YELLOW}⚙️  Phase 3: Repository & .env Setup${NC}"
echo ""

if [[ -d "$REPO_PATH/.git" ]]; then
  echo "Git repository exists. Updating..."
  cd "$REPO_PATH"
  git fetch origin --quiet
  echo -e "${GREEN}✅ Repository updated${NC}"
else
  echo "Cloning repository..."
  git clone https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI.git "$REPO_PATH" --depth=1 --quiet
  echo -e "${GREEN}✅ Repository cloned${NC}"
fi

echo ""
echo "Setting up .env file..."

if [[ -f "$ENV_FILE" ]]; then
  echo -e "${YELLOW}⚠️  .env already exists. Creating backup: .env.backup${NC}"
  cp "$ENV_FILE" "${ENV_FILE}.backup.${TIMESTAMP}"
fi

cat > "$ENV_FILE" << 'EOF'
# ── Build-Zeit (aus GitHub Secrets) ────────────────────────────────────────
# Diese Werte sollten von GitHub Actions gesetzt werden, wenn auf dem VPS
# deployed wird. Lokal brauchst du realistische Werte.
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
VITE_SENTRY_DSN=""

# ── Runtime ────────────────────────────────────────────────────────────────
# Host-Bind: 127.0.0.1 = nur lokal (sicher). Ändern nur mit Reverse-Proxy!
FRONTEND_HOST_BIND=127.0.0.1

# Host-Port: Default 8090. Muss frei sein.
FRONTEND_HOST_PORT=8090

# Image-Tag für Rollback
FRONTEND_IMAGE_TAG=latest

# Project-Name
COMPOSE_PROJECT_NAME=realsync
EOF

chmod 600 "$ENV_FILE"
echo -e "${GREEN}✅ .env created (mode 600 — nur Besitzer lesbar)${NC}"

echo ""
echo -e "${YELLOW}⚠️  WICHTIG: Bearbeite die .env-Datei mit deinen Werten:${NC}"
echo "   nano $ENV_FILE"
echo ""
echo "   Benötigte Werte:"
echo "   - VITE_SUPABASE_URL (aus GitHub Secrets: VITE_SUPABASE_URL)"
echo "   - VITE_SUPABASE_ANON_KEY (aus GitHub Secrets: VITE_SUPABASE_ANON_KEY)"
echo ""

################################################################################
# Phase 4: Port Availability Check
################################################################################

echo -e "${YELLOW}🔌 Phase 4: Port Availability Check${NC}"
echo ""

FRONTEND_PORT=${FRONTEND_HOST_PORT:-8090}

if ss -ltnp 2>/dev/null | grep -q ":${FRONTEND_PORT}\b"; then
  echo -e "${RED}❌ Port ${FRONTEND_PORT} is already in use:${NC}"
  ss -ltnp 2>/dev/null | grep ":${FRONTEND_PORT}" || true
  echo ""
  echo "Options:"
  echo "  1. Change FRONTEND_HOST_PORT in .env to another port (e.g., 8091)"
  echo "  2. Stop the service using this port"
  exit 1
else
  echo -e "${GREEN}✅ Port ${FRONTEND_PORT} is available${NC}"
fi

echo ""

################################################################################
# Phase 5: Initial Deployment (Optional)
################################################################################

echo -e "${YELLOW}🐳 Phase 5: Initial Docker Test${NC}"
echo ""

read -p "Ready to test Docker Compose? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  cd "$COMPOSE_DIR"

  echo "Pulling base images..."
  docker compose pull --quiet || echo "⚠️  Pull failed (may be expected)"

  echo "Building Docker image (this may take 1-2 minutes)..."
  if docker compose --env-file "$ENV_FILE" build --quiet 2>&1 | tee /tmp/build.log; then
    echo -e "${GREEN}✅ Build successful${NC}"
  else
    echo -e "${RED}❌ Build failed. Check logs:${NC}"
    tail -30 /tmp/build.log
    echo ""
    echo "Common issues:"
    echo "  - VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY missing or invalid in .env"
    echo "  - Network issues (DNS, proxy)"
    echo "  - Insufficient disk space"
    exit 1
  fi

  echo ""
  echo "Starting container..."
  if docker compose --env-file "$ENV_FILE" up -d 2>&1; then
    echo -e "${GREEN}✅ Container started${NC}"

    echo "Waiting for health check (30 seconds)..."
    sleep 30

    STATUS=$(docker inspect -f '{{.State.Health.Status}}' realsync-frontend 2>/dev/null || echo "unknown")
    if [[ "$STATUS" == "healthy" ]]; then
      echo -e "${GREEN}✅ Container is healthy${NC}"

      # Test healthz endpoint
      if curl -fsS http://127.0.0.1:${FRONTEND_PORT}/healthz >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Health endpoint reachable${NC}"
      else
        echo -e "${YELLOW}⚠️  Health endpoint not reachable (may need reverse-proxy setup)${NC}"
      fi
    else
      echo -e "${YELLOW}⚠️  Container status: ${STATUS}${NC}"
      docker compose logs --tail=20 frontend
    fi
  else
    echo -e "${RED}❌ Failed to start container${NC}"
    docker compose logs --tail=50 frontend || true
    exit 1
  fi
else
  echo "Skipped Docker test. Run manually later:"
  echo "  cd $COMPOSE_DIR"
  echo "  docker compose --env-file $ENV_FILE up -d --build"
fi

echo ""

################################################################################
# Phase 6: Post-Setup Instructions
################################################################################

echo -e "${GREEN}🎉 VPS Setup Complete!${NC}"
echo ""
echo "Next Steps:"
echo ""
echo "1. Edit .env file with your actual Supabase values:"
echo "   nano $ENV_FILE"
echo ""
echo "2. Set up GitHub Secrets (if not done):"
echo "   - VITE_SUPABASE_URL"
echo "   - VITE_SUPABASE_ANON_KEY"
echo "   - VPS_SSH_HOST (already set: 187.77.89.1)"
echo "   - VPS_SSH_USER (already set: root)"
echo "   - VPS_SSH_KEY"
echo "   - VPS_SSH_KNOWN_HOST"
echo ""
echo "3. Test deployment:"
echo "   Option A (automatic): git push origin main"
echo "   Option B (manual): GitHub Actions → Deploy Frontend to Hostinger VPS → Run workflow"
echo "   Option C (local): cd $COMPOSE_DIR && docker compose up -d --build"
echo ""
echo "4. Monitor logs:"
echo "   docker compose -f $COMPOSE_DIR/docker-compose.yml logs -f"
echo ""
echo "5. Check Reverse-Proxy setup (Traefik/nginx) to expose publicly"
echo ""
echo -e "${BLUE}For more details, see: $REPO_PATH/deploy/DEPLOYMENT_RUNBOOK.md${NC}"
echo ""

exit 0
