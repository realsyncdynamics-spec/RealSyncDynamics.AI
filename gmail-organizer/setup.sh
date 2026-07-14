#!/bin/bash

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Gmail Auto Organizer - Setup         ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""

# Check if credentials.json exists
if [ ! -f "credentials/credentials.json" ]; then
    echo -e "${RED}✗ credentials.json not found!${NC}"
    echo ""
    echo "Please follow these steps:"
    echo "1. Go to https://console.cloud.google.com/"
    echo "2. Create new project 'Gmail Organizer'"
    echo "3. Enable Gmail API"
    echo "4. Create OAuth 2.0 Desktop App credentials"
    echo "5. Download credentials.json"
    echo "6. Place it in: gmail-organizer/credentials/credentials.json"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓ credentials.json found${NC}"

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠ .env not found, creating from .env.example${NC}"
    cp .env.example .env

    echo ""
    echo "Please edit .env and set:"
    echo "  - GOOGLE_CLIENT_ID (from credentials.json)"
    echo "  - GOOGLE_CLIENT_SECRET (from credentials.json)"
    echo "  - GMAIL_USER (your Gmail address)"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓ .env configured${NC}"

# Create directories
mkdir -p credentials data logs

echo -e "${GREEN}✓ Directories created${NC}"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker not installed!${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker installed${NC}"

# Build and start
echo ""
echo -e "${YELLOW}Starting Docker container...${NC}"
docker compose up -d

echo ""
echo -e "${GREEN}✓ Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Wait for OAuth authentication (browser will open)"
echo "  2. Authorize the application"
echo "  3. Agent will start automatically"
echo ""
echo "View logs:"
echo "  docker compose logs -f organizer"
echo ""
