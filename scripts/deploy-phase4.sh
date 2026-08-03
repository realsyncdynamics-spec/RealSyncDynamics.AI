#!/bin/bash
# Phase 4 Deployment Script
# Automates Supabase infrastructure setup for Social Orchestrator persistence layer
# Usage: ./scripts/deploy-phase4.sh [staging|production]

set -e

ENVIRONMENT=${1:-staging}
SUPABASE_PROJECT=${SUPABASE_PROJECT:-}

if [ "$ENVIRONMENT" != "staging" ] && [ "$ENVIRONMENT" != "production" ]; then
  echo "Usage: $0 [staging|production]"
  exit 1
fi

echo "🚀 Phase 4 Deployment Script"
echo "Environment: $ENVIRONMENT"
echo "---"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Verify Supabase CLI
if ! command -v supabase &> /dev/null; then
  echo -e "${RED}✗ Supabase CLI not found. Install: https://supabase.com/docs/guides/cli${NC}"
  exit 1
fi
echo -e "${GREEN}✓${NC} Supabase CLI found"

# Step 2: Push migrations
echo ""
echo "📦 Deploying database migrations..."
if supabase db push --linked; then
  echo -e "${GREEN}✓${NC} Migrations deployed successfully"
else
  echo -e "${RED}✗${NC} Migration deployment failed"
  exit 1
fi

# Step 3: Deploy Edge Function
echo ""
echo "⚡ Deploying Edge Function: social-orchestrator-persistence"
if supabase functions deploy social-orchestrator-persistence; then
  echo -e "${GREEN}✓${NC} Edge Function deployed"
else
  echo -e "${RED}✗${NC} Edge Function deployment failed"
  exit 1
fi

# Step 4: Enable pg_cron (if not already enabled)
echo ""
echo "🔄 Configuring scheduled maintenance tasks..."
echo "   Note: pg_cron extension must be enabled in Supabase Cloud console"
echo "   Running: CREATE EXTENSION IF NOT EXISTS pg_cron"

# Note: This requires direct SQL access, typically done via Supabase dashboard
# or supabase sql command if available
cat > /tmp/enable_cron.sql << 'EOF'
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily DLQ cleanup at 2 AM UTC
SELECT cron.schedule(
  'cleanup_social_dlq',
  '0 2 * * *',
  'SELECT cleanup_social_dlq()'
);

-- Schedule hourly metrics rollup at minute 0 of every hour
SELECT cron.schedule(
  'rollup_publishing_metrics_hourly',
  '0 * * * *',
  'SELECT rollup_publishing_metrics_hourly()'
);

-- Verify cron jobs are scheduled
SELECT jobname, schedule, command FROM cron.job WHERE jobname LIKE 'cleanup%' OR jobname LIKE 'rollup%';
EOF

echo -e "${YELLOW}!${NC} Execute the following SQL in Supabase dashboard (SQL Editor):"
cat /tmp/enable_cron.sql
echo ""

# Step 5: Verify deployment
echo ""
echo "✅ Verifying deployment..."

# Test Edge Function
echo "   Testing Edge Function..."
FUNCTION_URL=$(supabase status | grep "Function" | grep "social-orchestrator-persistence" || echo "")
if [ -z "$FUNCTION_URL" ]; then
  echo -e "${YELLOW}!${NC} Could not verify Edge Function URL. Check manually in Supabase dashboard."
else
  echo -e "${GREEN}✓${NC} Edge Function is deployed"
fi

# Step 6: Summary
echo ""
echo "📋 Phase 4 Deployment Summary"
echo "============================"
echo -e "${GREEN}✓${NC} Database migrations deployed"
echo -e "${GREEN}✓${NC} Edge Function deployed (social-orchestrator-persistence)"
echo -e "${YELLOW}!${NC} Pending: Enable pg_cron and schedule maintenance tasks"
echo ""
echo "Next steps:"
echo "1. Copy the SQL from /tmp/enable_cron.sql"
echo "2. Paste into Supabase SQL Editor (Cloud Console)"
echo "3. Execute to enable cron scheduling"
echo "4. Run staging tests: npm run test"
echo "5. Run end-to-end tests to verify all 9 channels"
echo ""
echo -e "${GREEN}Ready for Phase 4 launch preparation!${NC}"
