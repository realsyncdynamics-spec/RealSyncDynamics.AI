#!/bin/bash

# Perplexity MCP VPS Deployment Script
# Usage: sudo bash deploy.sh [PERPLEXITY_API_KEY]

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SERVICE_NAME="perplexity-mcp"
SERVICE_USER="perplexity-mcp"
SERVICE_GROUP="perplexity-mcp"
INSTALL_DIR="/opt/RealSyncDynamics.AI/services/perplexity-mcp"
REPO_URL="https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI.git"
REPO_DIR="/opt/RealSyncDynamics.AI"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}Error: This script must be run as root${NC}"
   exit 1
fi

# Get API key from argument or prompt
if [ -z "$1" ]; then
    echo -e "${YELLOW}Enter your Perplexity API key:${NC}"
    read -sp "PERPLEXITY_API_KEY: " PERPLEXITY_API_KEY
    echo
else
    PERPLEXITY_API_KEY="$1"
fi

if [ -z "$PERPLEXITY_API_KEY" ]; then
    echo -e "${RED}Error: API key required${NC}"
    exit 1
fi

echo -e "${GREEN}Starting Perplexity MCP deployment...${NC}\n"

# Step 1: Clone or update repository
echo -e "${YELLOW}[1/8]${NC} Cloning/updating repository..."
if [ -d "$REPO_DIR" ]; then
    cd "$REPO_DIR"
    git pull origin main > /dev/null 2>&1
    echo -e "${GREEN}✓ Repository updated${NC}"
else
    git clone "$REPO_URL" "$REPO_DIR" > /dev/null 2>&1
    echo -e "${GREEN}✓ Repository cloned${NC}"
fi

# Step 2: Install Node.js if needed
echo -e "${YELLOW}[2/8]${NC} Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "Installing Node.js 18..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - > /dev/null 2>&1
    apt-get install -y nodejs > /dev/null 2>&1
fi
NODE_VERSION=$(node -v)
echo -e "${GREEN}✓ Node.js ${NODE_VERSION}${NC}"

# Step 3: Install dependencies
echo -e "${YELLOW}[3/8]${NC} Installing dependencies..."
cd "$INSTALL_DIR"
npm install --production > /dev/null 2>&1
echo -e "${GREEN}✓ Dependencies installed${NC}"

# Step 4: Create service user
echo -e "${YELLOW}[4/8]${NC} Setting up service user..."
if ! id "$SERVICE_USER" &>/dev/null; then
    useradd -r -s /bin/false "$SERVICE_USER"
    echo -e "${GREEN}✓ Service user created${NC}"
else
    echo -e "${GREEN}✓ Service user exists${NC}"
fi

# Step 5: Create .env file
echo -e "${YELLOW}[5/8]${NC} Creating configuration..."
cat > "$INSTALL_DIR/.env" <<EOF
PERPLEXITY_API_KEY=$PERPLEXITY_API_KEY
LOG_LEVEL=info
EOF

chmod 600 "$INSTALL_DIR/.env"
chown "$SERVICE_USER:$SERVICE_GROUP" "$INSTALL_DIR/.env"
echo -e "${GREEN}✓ Configuration created${NC}"

# Step 6: Set permissions
echo -e "${YELLOW}[6/8]${NC} Setting permissions..."
chown -R "$SERVICE_USER:$SERVICE_GROUP" "$INSTALL_DIR"
chmod 755 "$INSTALL_DIR"
echo -e "${GREEN}✓ Permissions set${NC}"

# Step 7: Create systemd service
echo -e "${YELLOW}[7/8]${NC} Creating systemd service..."
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<'EOF'
[Unit]
Description=Perplexity MCP Server
Documentation=https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/tree/main/services/perplexity-mcp
After=network.target

[Service]
Type=simple
User=perplexity-mcp
WorkingDirectory=/opt/RealSyncDynamics.AI/services/perplexity-mcp
EnvironmentFile=/opt/RealSyncDynamics.AI/services/perplexity-mcp/.env
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=perplexity-mcp

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/opt/RealSyncDynamics.AI/services/perplexity-mcp

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME" > /dev/null 2>&1
echo -e "${GREEN}✓ Systemd service created${NC}"

# Step 8: Start service
echo -e "${YELLOW}[8/8]${NC} Starting service..."
systemctl start "$SERVICE_NAME"
sleep 2

# Verify service is running
if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo -e "${GREEN}✓ Service started successfully${NC}"
else
    echo -e "${RED}✗ Service failed to start${NC}"
    echo -e "${YELLOW}Check logs with: sudo journalctl -u ${SERVICE_NAME} -n 50${NC}"
    exit 1
fi

# Display summary
echo -e "\n${GREEN}================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}================================${NC}\n"

echo "Service Name: $SERVICE_NAME"
echo "Install Dir:  $INSTALL_DIR"
echo "Status:       $(systemctl is-active $SERVICE_NAME)"
echo ""
echo "Useful commands:"
echo "  Status:  sudo systemctl status $SERVICE_NAME"
echo "  Logs:    sudo journalctl -u $SERVICE_NAME -f"
echo "  Stop:    sudo systemctl stop $SERVICE_NAME"
echo "  Restart: sudo systemctl restart $SERVICE_NAME"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Verify logs: sudo journalctl -u $SERVICE_NAME -f"
echo "2. Test API: curl -H 'Authorization: Bearer \$PERPLEXITY_API_KEY' https://api.perplexity.ai/chat/completions"
echo "3. Rotate API key quarterly for security"
echo ""
