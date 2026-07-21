# Phase 4: Staging Environment Setup Template

**Timeline**: 2-3 days before staging tests  
**Owner**: DevOps/Backend Engineering  
**Checklist**: Complete all items before test execution

---

## 1. Supabase Staging Project Creation

### 1.1 Create Staging Project

```bash
# Via Supabase CLI
supabase projects create \
  --name "RealSyncDynamics.AI Staging" \
  --db-pass "$(openssl rand -base64 32)" \
  --region us-east-1

# Via Supabase Console:
# 1. Go to supabase.com/dashboard
# 2. Click "New project"
# 3. Name: "RealSyncDynamics.AI Staging"
# 4. Region: us-east-1 (or closest to team)
# 5. Database password: Generate strong password
# 6. Create project (wait 3-5 minutes)
```

### 1.2 Capture Project Credentials

After project created, save these to `.env.staging.local`:

```bash
SUPABASE_URL_STAGING=https://[project-id].supabase.co
SUPABASE_ANON_KEY_STAGING=[anon-key-from-settings]
SUPABASE_SERVICE_ROLE_KEY_STAGING=[service-role-key-from-settings]
SUPABASE_JWT_SECRET_STAGING=[jwt-secret-from-settings]
```

**Location**: Settings → API → Project URL & Keys

---

## 2. Database Migrations & Setup

### 2.1 Deploy Migrations to Staging

```bash
# 1. Link Supabase CLI to staging project
supabase link --project-ref [project-id]

# 2. Push all migrations
supabase db push --linked

# 3. Verify migrations applied
psql -h [project-id].supabase.co -U postgres \
  -d postgres \
  -c "SELECT * FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
```

**Expected tables**: 25 tables including:
- social_dlq_entries
- social_publishing_metrics
- social_publishing_metrics_hourly
- social_audit_log
- (Plus existing governance tables)

### 2.2 Verify RLS Policies

```sql
-- Run in Supabase SQL Editor
-- Verify RLS policies on social_* tables
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'social_%'
ORDER BY tablename;

-- Expected output: rowsecurity = t (true) for all social_* tables
```

### 2.3 Enable pg_cron Extension

```sql
-- Run in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule cleanup job (2 AM UTC daily)
SELECT cron.schedule(
  'cleanup_social_dlq',
  '0 2 * * *',
  'SELECT cleanup_social_dlq()'
);

-- Schedule metrics rollup (every hour at minute 0)
SELECT cron.schedule(
  'rollup_publishing_metrics_hourly',
  '0 * * * *',
  'SELECT rollup_publishing_metrics_hourly()'
);

-- Verify jobs scheduled
SELECT jobname, schedule, command FROM cron.job
WHERE jobname LIKE 'cleanup%' OR jobname LIKE 'rollup%';
```

---

## 3. Edge Function Deployment

### 3.1 Deploy Social-Orchestrator Persistence Function

```bash
# 1. Link to staging project (if not already linked)
supabase link --project-ref [project-id]

# 2. Deploy Edge Function
supabase functions deploy social-orchestrator-persistence

# 3. Verify deployment
supabase functions list

# 4. Check logs for errors
supabase functions get-logs social-orchestrator-persistence --limit 50
```

### 3.2 Test Edge Function

```bash
# Test DLQ enqueue operation
curl -X POST https://[project-id].supabase.co/functions/v1/social-orchestrator-persistence \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY_STAGING" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "dlq:enqueue",
    "queueEntryId": "test-12345",
    "channel": "linkedin.enterprise",
    "errorCode": "TEST_ERROR",
    "errorMessage": "Test error for verification",
    "retryCount": 0
  }'

# Expected response: { "success": true, "dlqId": "..." }
```

---

## 4. Supabase Vault: API Credentials

### 4.1 Create Vault Secrets for Each Platform

In Supabase Dashboard → Settings → Vault:

**LinkedIn**:
```
Secret Name: LINKEDIN_ACCESS_TOKEN
Value: [OAuth token from LinkedIn Developer Portal]
```

**X (Twitter)**:
```
Secret Name: X_API_KEY
Value: [API Key from Twitter Developer Portal]

Secret Name: X_API_SECRET
Value: [API Secret from Twitter Developer Portal]
```

**Meta (Instagram)**:
```
Secret Name: META_ACCESS_TOKEN
Value: [Access token from Meta App Dashboard]
```

**TikTok**:
```
Secret Name: TIKTOK_ACCESS_TOKEN
Value: [Access token from TikTok Developer Console]
```

**SendGrid (Email)**:
```
Secret Name: SENDGRID_API_KEY
Value: [API Key from SendGrid Dashboard]
```

**WordPress** (if applicable):
```
Secret Name: WORDPRESS_API_TOKEN
Value: [REST API token from WordPress site]
```

**Ghost** (if applicable):
```
Secret Name: GHOST_ADMIN_API_KEY
Value: [Admin API key from Ghost dashboard]
```

### 4.2 Verify Vault Access

```sql
-- Test vault access (run as service_role)
SELECT vault.decrypted_secret('LINKEDIN_ACCESS_TOKEN') as token;

-- Should return the token value (not null)
```

---

## 5. Monitoring Setup

### 5.1 Enable PostgreSQL Monitoring

```sql
-- Run in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pg_stat_monitor;

-- Create monitoring views (see MONITORING_SETUP.md Section 13.1)
-- Copy and execute all monitoring views
```

### 5.2 Configure Sentry for Staging

```bash
# 1. Create Sentry project for staging
# supabase/functions/social-orchestrator-persistence/index.ts

# 2. Set environment variable
export SENTRY_DSN=https://[key]@sentry.io/[project-id]
export ENVIRONMENT=staging

# 3. Verify in function logs
supabase functions get-logs social-orchestrator-persistence
```

### 5.3 Set Up Slack Webhook (Optional but Recommended)

```bash
# 1. Create Slack incoming webhook: https://api.slack.com/messaging/webhooks
# 2. Save webhook URL to environment
export SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# 3. Test webhook
curl -X POST "$SLACK_WEBHOOK_URL" \
  -H 'Content-type: application/json' \
  -d '{"text":"✅ Staging environment ready for Phase 4 testing"}'
```

---

## 6. Test Data Preparation

### 6.1 Create Test Tenant

```sql
-- Run in Supabase SQL Editor
INSERT INTO tenants (name, created_at)
VALUES ('Phase 4 Test Tenant', NOW())
RETURNING id, name, created_at;
```

Save the returned `id` — you'll use this for test runs.

### 6.2 Create Test Social Queue Entries (Optional)

```sql
-- Create sample queue entries for each channel
INSERT INTO social_publishing_queue (
  tenant_id, channel, body, status, created_at
) VALUES
  ('[tenant-id]', 'linkedin.enterprise', 'Test LinkedIn post', 'pending', NOW()),
  ('[tenant-id]', 'x.alert', 'Test X alert (max 280 chars)', 'pending', NOW()),
  ('[tenant-id]', 'instagram.reel', 'Test Instagram caption', 'pending', NOW()),
  ('[tenant-id]', 'tiktok.fast', 'Test TikTok post', 'pending', NOW()),
  ('[tenant-id]', 'email.newsletter', 'Test email content', 'pending', NOW());
```

---

## 7. Pre-Test Verification Checklist

Before running STAGING_TEST_GUIDE.md tests:

- [ ] Supabase staging project created
- [ ] All migrations deployed (`supabase db push`)
- [ ] Social-* tables exist and have RLS policies
- [ ] pg_cron extension enabled
- [ ] Cron jobs scheduled (cleanup, rollup)
- [ ] Edge Function deployed (`social-orchestrator-persistence`)
- [ ] Edge Function test successful (DLQ enqueue works)
- [ ] All 7 API credentials in Vault (LinkedIn, X, Meta, TikTok, SendGrid, etc.)
- [ ] Vault secrets verified (SELECT vault.decrypted_secret)
- [ ] Monitoring views created (dlq_status, metrics_rollup_health, etc.)
- [ ] Sentry DSN configured
- [ ] Slack webhook tested (optional)
- [ ] Test tenant created
- [ ] Team has access to Supabase project

---

## 8. Environment Variables Reference

Keep these in `.env.staging.local` (git-ignored):

```bash
# Supabase Staging
SUPABASE_URL_STAGING=https://[project-id].supabase.co
SUPABASE_ANON_KEY_STAGING=[anon-key]
SUPABASE_SERVICE_ROLE_KEY_STAGING=[service-role-key]

# Sentry
SENTRY_DSN=https://[key]@sentry.io/[project-id]
ENVIRONMENT=staging

# Slack (optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Test Data
TEST_TENANT_ID=[from step 6.1]
```

---

## 9. Rollback Procedure

If staging needs to be torn down and recreated:

```bash
# 1. Delete staging project via Supabase Console
# Settings → Danger Zone → Delete Project

# 2. Unlink local CLI
supabase unlink

# 3. Start fresh from Section 1
```

---

## 10. Sign-Off

| Role | Name | Date | Notes |
|------|------|------|-------|
| DevOps Lead | [ ] | [ ] | Verified infrastructure |
| Engineering Lead | [ ] | [ ] | Reviewed procedures |
| QA Lead | [ ] | [ ] | Ready to execute tests |

---

**Status**: Ready for staging test execution  
**Next**: Execute STAGING_TEST_GUIDE.md  
**Timeline**: Tests should complete within 8-12 hours

