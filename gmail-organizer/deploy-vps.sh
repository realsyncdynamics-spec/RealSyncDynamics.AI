#!/bin/bash

# Deploy to VPS
# Usage: ./deploy-vps.sh user@vps.example.com

if [ -z "$1" ]; then
    echo "Usage: ./deploy-vps.sh user@vps.example.com"
    exit 1
fi

VPS_HOST="$1"
VPS_PATH="/opt/gmail-organizer"

echo "Deploying to $VPS_HOST:$VPS_PATH"

# Create directory on VPS
ssh "$VPS_HOST" "mkdir -p $VPS_PATH"

# Copy files (exclude credentials and data)
rsync -av --exclude=credentials --exclude=data --exclude=logs --exclude=.git \
    . "$VPS_HOST:$VPS_PATH/"

# Create credentials directory
ssh "$VPS_HOST" "mkdir -p $VPS_PATH/credentials $VPS_PATH/data $VPS_PATH/logs"

echo "Deployment complete!"
echo ""
echo "Next steps on VPS:"
echo "  1. ssh $VPS_HOST"
echo "  2. cd $VPS_PATH"
echo "  3. cp .env.example .env"
echo "  4. Edit .env with your config"
echo "  5. Upload credentials.json to credentials/"
echo "  6. docker compose up -d"
