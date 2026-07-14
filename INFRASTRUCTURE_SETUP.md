# RealSyncDynamics.AI — Infrastructure Provisioning & Setup

## Overview

Complete infrastructure setup guide for RealSyncDynamics.AI covering Supabase, Cloudflare Pages, API integrations, and disaster recovery.

---

## Phase 1: Foundation Setup

### 1.1 Supabase Project Creation

1. Go to https://supabase.com
2. Create new organization (if needed)
3. Create new project:
   - **Name:** RealSyncDynamics (production)
   - **Region:** Europe (Ireland recommended for GDPR)
   - **Database:** PostgreSQL 15+
   - **Connection pooling:** Enable (pgBouncer)
   - **Max connections:** 100 (default)

4. Copy credentials:
   ```
   VITE_SUPABASE_URL=https://xxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```

### 1.2 Enable Required Extensions

In Supabase dashboard → Database → Extensions:
```sql
-- Enable essential extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pgtap";        -- Testing
CREATE EXTENSION IF NOT EXISTS "plpgsql";      -- Stored procedures
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- Query monitoring
```

### 1.3 Configure Authentication

In Supabase dashboard → Authentication → Providers:

**Email/Password:**
- [ ] Enable email provider
- [ ] Set email confirmation required: Yes
- [ ] Email double confirmation: Yes (for sensitive changes)
- [ ] Max rate: 100 per hour

**OAuth Providers (optional):**
- [ ] Google OAuth (for developer convenience)
- [ ] GitHub OAuth (for team members)

### 1.4 Set Up User Roles & Permissions

```sql
-- Service roles for edge functions
CREATE ROLE service_role NOINHERIT;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Read-only role for monitoring/analytics
CREATE ROLE analytics_role NOINHERIT;
GRANT USAGE ON SCHEMA public TO analytics_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO analytics_role;
```

---

## Phase 2: Database Schema & Migrations

### 2.1 Apply Initial Migrations

```bash
# Set up Supabase CLI
npm install -g supabase

# Link to Supabase project
supabase link --project-ref <project-ref>

# Push migrations
supabase db push

# Verify migrations applied
supabase migration list
```

### 2.2 Critical Tables

Verify these tables exist with RLS enabled:

```sql
-- Check RLS enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE tablename IN (
  'users', 'tenants', 'compliance_scores', 
  'compliance_alert_rules', 'compliance_alert_log',
  'compliance_remediation_tasks', 'webhook_subscriptions'
);
```

### 2.3 Index Strategy

Create performance indexes:

```sql
-- Tenant queries
CREATE INDEX idx_compliance_alert_rules_tenant_id 
  ON compliance_alert_rules(tenant_id, enabled);

CREATE INDEX idx_compliance_alert_log_tenant_id 
  ON compliance_alert_log(tenant_id, created_at);

CREATE INDEX idx_webhook_subscriptions_tenant_id 
  ON webhook_subscriptions(tenant_id, enabled);

-- Search/filter
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_tenants_name ON tenants(name);

-- Full-text search
CREATE INDEX idx_compliance_incidents_fts 
  ON compliance_incidents USING gin(to_tsvector('english', description));
```

### 2.4 Row Level Security (RLS) Policies

Verify critical RLS policies:

```sql
-- Users can only access their tenant's data
CREATE POLICY "Users access own tenant"
  ON compliance_alert_rules
  FOR SELECT USING (
    tenant_id = (
      SELECT tenant_id FROM tenants 
      WHERE owner_id = auth.uid()
    )
  );

-- Service role bypasses RLS (for edge functions)
ALTER ROLE service_role BYPASSRLS;
```

---

## Phase 3: API & Edge Functions Setup

### 3.1 Deploy Edge Functions

```bash
# List all functions
supabase functions list

# Deploy function
supabase functions deploy dashboard-intelligence

# Deploy all functions
for func in supabase/functions/*/; do
  supabase functions deploy $(basename $func)
done

# Verify deployment
supabase functions list --no-truncate
```

### 3.2 Function Configuration

Set environment variables for each function:

```bash
# In Supabase dashboard → Edge Functions → Secrets

ANTHROPIC_API_KEY=sk-ant-...
STRIPE_SECRET_KEY=sk_live_...
RESEND_API_KEY=...
SENTRY_DSN=https://...@sentry.io/...
```

### 3.3 Webhook Delivery System Setup

```sql
-- Verify webhook tables exist
SELECT * FROM webhook_subscriptions LIMIT 1;
SELECT * FROM webhook_events_log LIMIT 1;

-- Enable event triggers
CREATE TRIGGER webhook_on_alert_created
  AFTER INSERT ON compliance_alert_log
  FOR EACH ROW EXECUTE FUNCTION http_post_webhook_event('alert.created');
```

---

## Phase 4: Cloudflare Pages Deployment

### 4.1 Connect Repository

1. Go to https://dash.cloudflare.com/pages
2. Create new project → Connect to Git
3. Select repository: `realsyncdynamics-spec/RealSyncDynamics.AI`
4. Configure build:
   - **Framework:** Vite
   - **Build command:** `npm run build:full`
   - **Build output directory:** `dist`
   - **Root directory:** `/`

### 4.2 Environment Variables

Set in Cloudflare Pages → Settings → Environment Variables:

```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_SENTRY_DSN=https://...@sentry.io/...
VITE_SENTRY_ENVIRONMENT=production
```

### 4.3 Custom Domain & SSL

1. Go to Custom domains
2. Add: `realsyncdynamics.ai`
3. Add CNAME record in DNS registrar:
   - **Name:** realsyncdynamics.ai
   - **Type:** CNAME
   - **Value:** realsyncdynamics-spec.pages.dev
4. SSL certificate auto-provisioned (1-5 min)

### 4.4 Caching & CDN Settings

In Cloudflare dashboard:

1. **Cache Rules:** 
   - Static assets: Cache 1 year
   - HTML files: Cache 30 minutes
   - API endpoints: Cache 0 minutes

2. **Performance:**
   - Enable Brotli compression
   - Enable HTTP/3 (QUIC)
   - Enable Early Hints

3. **Security:**
   - Enable DDoS protection
   - Set security level: High
   - Enable WAF rules

---

## Phase 5: Payment & Billing Setup

### 5.1 Stripe Configuration

1. Go to https://dashboard.stripe.com
2. Create Restricted API Key:
   - Name: `RealSyncDynamics API`
   - Permissions: Charge, Customer, Webhook
   - Restricted to: Payment processing scope

3. Copy keys:
   ```
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

### 5.2 Create Billing Products

In Stripe → Products:

**Product: RealSyncDynamics Pro**
- Price: €99/month
- Billing interval: Monthly
- Trial period: 14 days

**Product: RealSyncDynamics Enterprise**
- Price: Custom (contact sales)
- Billing interval: Annual
- Custom branding

### 5.3 Configure Webhooks

1. Go to Webhooks
2. Add endpoint: `https://api.realsyncdynamics.ai/functions/v1/stripe-webhook`
3. Subscribe to events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`

### 5.4 Webhook Secret

```bash
# In Supabase Edge Function env
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## Phase 6: Email Service Setup

### 6.1 Resend Configuration

1. Go to https://resend.com
2. Create API key
3. Copy:
   ```
   RESEND_API_KEY=re_...
   ```

### 6.2 Email Templates

Configure in Supabase → Storage:

```
emails/
├── welcome.html          → New user signup
├── alert-notification.html → Compliance alerts
├── billing-receipt.html  → Payment confirmation
├── invite-team.html      → Workspace invitations
└── reset-password.html   → Password recovery
```

### 6.3 Sender Identity

In Resend dashboard:
- Verify sender domain: `noreply@realsyncdynamics.ai`
- Add SPF/DKIM records to DNS
- Set bounce/complaint handlers

---

## Phase 7: Monitoring & Observability

### 7.1 Sentry Project Setup

1. Go to https://sentry.io
2. Create organization: RealSyncDynamics
3. Create project: React
4. Copy DSN:
   ```
   SENTRY_DSN=https://xxx@sentry.io/project-id
   ```

### 7.2 Configure Releases

```bash
# Install Sentry CLI
npm install -g @sentry/cli

# Create release
sentry-cli releases create my-app@1.0.0

# Upload sourcemaps
sentry-cli releases files upload-sourcemaps my-app@1.0.0 ./dist
```

### 7.3 Alert Rules

Create in Sentry → Alerts:

```
Rule 1: Error rate spike
  Condition: error_count > 10 in last 5 minutes
  Action: Alert team

Rule 2: New error pattern
  Condition: First occurrence of new error
  Action: Create issue
```

---

## Phase 8: Backup & Disaster Recovery

### 8.1 Supabase Backups

Automatic daily backups enabled:
- Retention: 7 days
- Frequency: Daily at 2 AM UTC
- Location: EU (Ireland)

### 8.2 Manual Backup Procedure

```bash
# Download database backup
supabase db download --no-password > backup.sql

# Store in secure location
# Encrypted backup: gpg -c backup.sql

# Verify backup (test restore in staging)
supabase db push < backup.sql
```

### 8.3 Data Recovery Drill

Monthly test (1st Tuesday of month):
1. Create staging backup from previous month
2. Run data recovery test
3. Verify data integrity
4. Document time to recovery
5. Post results in #infrastructure channel

---

## Phase 9: Security Hardening

### 9.1 API Key Rotation

Set calendar reminders for:
- **Quarterly:** Rotate all API keys
- **Immediately:** If key exposure detected
- **Annually:** Full security audit

### 9.2 Network Security

```bash
# Enable IP allowlisting (if available)
# Restrict edge function access to known IPs
# Enable VPC endpoints for database access

# Firewall rules
supabase firewall-rules create \
  --allowed-ips 0.0.0.0/0 \
  --denied-ips malicious.ip.address
```

### 9.3 Secrets Management

```bash
# All secrets in environment variables ONLY
# Never commit to git

# Rotate secrets
# 1. Generate new key in provider
# 2. Update in Cloudflare Pages
# 3. Update in Supabase
# 4. Revoke old key
# 5. Monitor for errors during transition
```

---

## Phase 10: Performance Optimization

### 10.1 Database Connection Pooling

In Supabase:
- Max pool size: 100
- Min pool size: 10
- Max idle time: 30 seconds
- Connection timeout: 5 seconds

### 10.2 Caching Strategy

```
Frontend (Cloudflare):
├── Static assets: 1 year cache
├── HTML files: 30 min cache
└── API responses: No cache (handled by app)

Application (Service Worker):
├── Cache critical resources
├── Offline support enabled
└── Cache expiration: 7 days
```

### 10.3 CDN Configuration

Cloudflare settings:
- [ ] Brotli compression enabled
- [ ] HTTP/3 (QUIC) enabled
- [ ] Always online: Enabled
- [ ] Image optimization: Enabled

---

## Phase 11: Capacity Planning

### 11.1 Database Capacity

Monthly review:
```sql
-- Check table growth
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Estimate growth rate
-- If > 80% of quota: Plan upgrade
```

### 11.2 Function Capacity

Monitor in Cloudflare:
- CPU time per request (avg/max)
- Memory usage per request
- Cold start times
- Execution timeout frequency

### 11.3 Upgrade Path

**Current limits:**
- Database: 500GB (Supabase Pro)
- Functions: 10M requests/month (Cloudflare Workers)
- API requests: Unlimited (Supabase)

**When to upgrade:**
- Database: > 400GB used
- Functions: > 8M requests/month
- Concurrent users: > 10,000

---

## Phase 12: Post-Launch Checklist

- [ ] All infrastructure documented (this file)
- [ ] Backup strategy tested and verified
- [ ] Disaster recovery drill completed successfully
- [ ] Monitoring dashboards operational
- [ ] On-call rotation established
- [ ] Runbooks written and tested
- [ ] Team trained on infrastructure
- [ ] Security audit completed
- [ ] Performance targets verified
- [ ] Cost optimization reviewed

---

## Quick Reference Commands

```bash
# Supabase
supabase projects list
supabase db reset                 # Development only
supabase db push                  # Apply migrations
supabase functions list
supabase functions get-logs <name>

# Cloudflare
wrangler deploy                   # Deploy workers
wrangler tail                     # Stream logs
wrangler kv:key list <namespace>

# Monitoring
sentry-cli releases list
sentry-cli health-check
curl https://realsyncdynamics.ai/health

# Database
psql -h db.supabase.co -U postgres -d postgres \
  -c "SELECT * FROM pg_stat_statements LIMIT 10;"

# Backup
supabase db download > backup.sql
gzip backup.sql
```

---

## Cost Optimization

### Current Monthly Costs (Estimate)

| Service | Cost | Usage |
|---------|------|-------|
| Supabase | €50-200 | DB storage + API |
| Cloudflare Pages | $0 | 500GB bandwidth |
| Stripe | 2.9% + $0.30 | Per transaction |
| Sentry | $29 | Error tracking |
| Email (Resend) | $20 | 1,000 emails |
| **Total** | **~$120-350/mo** | |

### Optimization Opportunities

- [ ] Review unused databases/projects
- [ ] Archive old logs (Sentry → cold storage)
- [ ] Optimize queries (reduce database calls)
- [ ] Enable image optimization (save CDN bandwidth)
- [ ] Review Stripe transaction volumes quarterly

---

**Last Updated:** 2026-07-06  
**Status:** Ready for Production  
**Next Review:** Monthly
