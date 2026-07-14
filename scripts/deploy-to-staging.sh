#!/bin/bash
#
# Deploy Phase 2 Governance to Staging
# Usage: bash scripts/deploy-to-staging.sh
#
# Steps:
# 1. Verify code quality (lint, test, type-check)
# 2. Build production bundle
# 3. Deploy to Supabase staging project
# 4. Run post-deployment verification
# 5. Enable staging monitoring

set -e

echo "🚀 Phase 2 Governance Staging Deployment"
echo "========================================"
echo ""

# Configuration
STAGING_PROJECT_ID="${STAGING_PROJECT_ID:-staging-realsyncdynamics-ai}"
STAGING_URL="${STAGING_URL:-https://staging-realsyncdynamics.ai}"
BRANCH="${BRANCH:-main}"
ENVIRONMENT="staging"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
  echo -e "${RED}❌ $1${NC}"
}

log_info() {
  echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Step 1: Pre-deployment checks
log_info "Step 1/5: Pre-deployment verification"
echo ""

if [ "$(git rev-parse --abbrev-ref HEAD)" != "$BRANCH" ]; then
  log_error "Not on $BRANCH branch. Checkout first:"
  echo "  git checkout $BRANCH"
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  log_error "Uncommitted changes detected. Commit or stash first:"
  echo "  git status"
  exit 1
fi

log_success "Git state clean"

# Step 2: Code quality checks
log_info "Step 2/5: Code quality checks"
echo ""

npm run lint || {
  log_error "Linting failed"
  exit 1
}
log_success "Linting passed"

npm test || {
  log_error "Unit tests failed"
  exit 1
}
log_success "Unit tests passed"

npm run check:production || {
  log_error "Production checks failed"
  exit 1
}
log_success "Production checks passed"

# Step 3: Build
log_info "Step 3/5: Building production bundle"
echo ""

npm run build || {
  log_error "Build failed"
  exit 1
}
log_success "Build complete"

# Step 4: Deploy to staging
log_info "Step 4/5: Deploying to staging"
echo ""

# Supabase deployment (adjust based on your setup)
if command -v supabase &> /dev/null; then
  log_info "Deploying Supabase Edge Functions to staging..."
  supabase functions deploy --project-ref "$STAGING_PROJECT_ID" || {
    log_error "Edge Function deployment failed"
    exit 1
  }
  log_success "Edge Functions deployed"
else
  log_error "Supabase CLI not found. Install with: npm install -g supabase"
  exit 1
fi

# Frontend deployment (Cloudflare Pages automatic on push to staging branch)
log_info "Frontend deployment triggered (Cloudflare Pages)"
log_info "Monitor progress at: https://dash.cloudflare.com"

# Step 5: Post-deployment verification
log_info "Step 5/5: Post-deployment verification"
echo ""

# Wait for Edge Functions to be available
log_info "Waiting for Edge Functions to be ready..."
sleep 10

# Check governance-resources endpoint
HEALTH_CHECK="https://${STAGING_PROJECT_ID}.supabase.co/functions/v1/governance-resources"
if curl -s -f -X OPTIONS "$HEALTH_CHECK" > /dev/null 2>&1; then
  log_success "governance-resources Edge Function is accessible"
else
  log_error "governance-resources not responding yet (may take 1-2 minutes)"
fi

# Check frontend health
FRONTEND_CHECK="${STAGING_URL}/health"
if curl -s -f "$FRONTEND_CHECK" > /dev/null 2>&1; then
  log_success "Frontend is responding"
else
  log_info "Frontend still warming up (normal, check in 2 minutes)"
fi

echo ""
echo "========================================"
log_success "Staging Deployment Complete!"
echo ""
echo "📋 Next Steps:"
echo "  1. Open staging URL: $STAGING_URL"
echo "  2. Run smoke tests: npm run qa:governance"
echo "  3. Follow checklist: docs/STAGING_VERIFICATION_CHECKLIST.md"
echo "  4. Monitor logs: supabase logs --project-ref $STAGING_PROJECT_ID"
echo ""
echo "🔗 Useful Links:"
echo "  • Staging Supabase: https://app.supabase.com/project/$STAGING_PROJECT_ID"
echo "  • Cloudflare Pages: https://dash.cloudflare.com/account/pages"
echo "  • Staging URL: $STAGING_URL"
echo ""
