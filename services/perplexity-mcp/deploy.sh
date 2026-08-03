#!/bin/bash

# Perplexity MCP Docker Deployment Script
# For Hostinger VPS with existing Traefik setup
#
# Usage:
#   sudo bash deploy.sh
#   bash deploy.sh pplx_your_api_key_here

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
REPO_URL="https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI.git"
REPO_DIR="/opt/RealSyncDynamics.AI"
SERVICE_NAME="perplexity-mcp"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Perplexity MCP Docker Deployment     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}\n"

# Get API key from argument or prompt
if [ -z "$1" ]; then
    echo -e "${YELLOW}Enter your Perplexity API key (pplx_...):${NC}"
    read -sp "> " PERPLEXITY_API_KEY
    echo
else
    PERPLEXITY_API_KEY="$1"
fi

if [ -z "$PERPLEXITY_API_KEY" ]; then
    echo -e "${RED}✗ API key required${NC}"
    exit 1
fi

# Step 1: Check Docker
echo -e "${YELLOW}[1/6]${NC} Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker not found. Install Docker first.${NC}"
    exit 1
fi
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}✗ Docker Compose not found. Install Docker Compose first.${NC}"
    exit 1
fi
DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | cut -d',' -f1)
echo -e "${GREEN}✓ Docker ${DOCKER_VERSION}${NC}"

# Step 2: Clone/update repository
echo -e "${YELLOW}[2/6]${NC} Cloning/updating repository..."
if [ -d "$REPO_DIR" ]; then
    cd "$REPO_DIR"
    git pull origin main > /dev/null 2>&1 || true
    echo -e "${GREEN}✓ Repository updated${NC}"
else
    git clone "$REPO_URL" "$REPO_DIR" > /dev/null 2>&1
    echo -e "${GREEN}✓ Repository cloned${NC}"
fi

cd "$REPO_DIR/services/perplexity-mcp"

# Step 3: Create .env
echo -e "${YELLOW}[3/6]${NC} Creating configuration..."
cat > .env <<EOF
PERPLEXITY_API_KEY=$PERPLEXITY_API_KEY
LOG_LEVEL=info
EOF

chmod 600 .env
echo -e "${GREEN}✓ Configuration created (.env)${NC}"

# Step 4: Build image
echo -e "${YELLOW}[4/6]${NC} Building Docker image..."
docker compose build --no-cache > /dev/null 2>&1
echo -e "${GREEN}✓ Image built${NC}"

# Step 5: Create/check Traefik network
echo -e "${YELLOW}[5/6]${NC} Checking Traefik network..."
TRAEFIK_NETWORK="proxy"
if ! docker network ls | grep -q "$TRAEFIK_NETWORK"; then
    echo -e "${YELLOW}  Creating network: $TRAEFIK_NETWORK${NC}"
    docker network create "$TRAEFIK_NETWORK" > /dev/null 2>&1
fi
echo -e "${GREEN}✓ Traefik network ready${NC}"

# Step 6: Start container
echo -e "${YELLOW}[6/6]${NC} Starting container..."
docker compose up -d > /dev/null 2>&1

sleep 2

# Verify
if docker compose ps | grep -q "Up"; then
    echo -e "${GREEN}✓ Container started${NC}"
else
    echo -e "${RED}✗ Container failed to start${NC}"
    echo -e "${YELLOW}Check logs:${NC} docker compose logs"
    exit 1
fi

# Summary
echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}\n"

CONTAINER_ID=$(docker compose ps -q perplexity-mcp)
CONTAINER_STATUS=$(docker inspect "$CONTAINER_ID" --format='{{.State.Status}}')

echo "Service:      $SERVICE_NAME"
echo "Location:     $REPO_DIR/services/perplexity-mcp"
echo "Status:       $CONTAINER_STATUS"
echo "Container ID: ${CONTAINER_ID:0:12}"
echo ""

echo -e "${YELLOW}Useful Commands:${NC}"
echo "  Logs (live):     docker compose logs -f"
echo "  Status:          docker compose ps"
echo "  Restart:         docker compose restart"
echo "  Stop:            docker compose stop"
echo "  Inspect config:  docker compose config"
echo ""

echo -e "${YELLOW}Traefik Routing:${NC}"
echo "  Domain:     mcp.realsyncdynamicsai.de"
echo "  Backend:    $SERVICE_NAME:3000"
echo "  Network:    $TRAEFIK_NETWORK"
echo ""

echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Verify logs:   docker compose logs -f"
echo "  2. Test routing:  curl -k https://mcp.realsyncdynamicsai.de"
echo "  3. Update DNS:    Point mcp.realsyncdynamicsai.de to your VPS IP"
echo "  4. Monitor:       docker stats $SERVICE_NAME"
echo ""

echo -e "${GREEN}Setup complete! ✓${NC}"
