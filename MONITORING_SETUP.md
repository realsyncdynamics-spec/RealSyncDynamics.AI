# RealSyncDynamics.AI — Monitoring & Observability Setup Guide

## Overview

Complete monitoring setup for RealSyncDynamics.AI production environment covering error tracking, performance monitoring, infrastructure health, and business metrics.

---

## 1. Sentry Setup (Error Tracking & Performance)

### Initial Configuration
1. Create project at https://sentry.io (EU region recommended)
2. Select "React" as platform
3. Copy `SENTRY_DSN` value
4. Add to environment variables:
   ```
   SENTRY_DSN=https://xxx@sentry.io/project-id
   SENTRY_ENVIRONMENT=production
   SENTRY_RELEASE=1.0.0
   ```

### Client-Side Configuration (src/lib/sentry.ts)
```typescript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || 'development',
  tracesSampleRate: 0.1, // 10% of transactions
  beforeSend(event) {
    // Filter out noise
    if (event.request?.url?.includes('localhost')) return null;
    return event;
  },
});
```

### Server-Side Configuration (supabase/functions)
```typescript
import * as Sentry from "https://deno.land/x/sentry@8.9.1/index.ts";

Sentry.init({
  dsn: Deno.env.get("SENTRY_DSN"),
  environment: "production",
  tracesSampleRate: 1.0,
});
```

### Key Alert Rules to Configure

#### 1. High Error Rate
```
Condition: Error rate > 1%
Window: Last 5 minutes
Action: Page on-call engineer + #critical-alerts Slack
```

#### 2. Unhandled Promise Rejection
```
Condition: event.exception.type = "UnhandledPromiseRejection"
Action: #alerts Slack + auto-create ticket
```

#### 3. Database Connection Errors
```
Condition: message CONTAINS "connection pool" OR "PGSQL_CONNECTION"
Action: #infrastructure Slack + incident severity: P1
```

#### 4. Authentication Failures
```
Condition: exception.message CONTAINS "auth" AND error_count > 10
Window: 15 minutes
Action: #security Slack + page lead engineer
```

### Sentry Dashboards to Create

**Dashboard 1: Health Overview**
- Error rate (24h trend)
- P95 latency (frontend vs edge functions)
- User sessions (crash-free %)
- Top errors (last 24h)
- Replay video of errors

**Dashboard 2: Backend Health**
- Edge function errors by function
- Edge function latency percentiles
- Database query errors
- API response time distribution

**Dashboard 3: Frontend Performance**
- Core Web Vitals (LCP, FID, CLS)
- JS bundle size impact on LCP
- Page load time by route
- React component render times

---

## 2. Supabase Monitoring

### Dashboard Setup
1. Navigate to https://supabase.com/dashboard/projects
2. Select RealSyncDynamics.AI project
3. Go to Monitoring → Database

### Key Metrics to Monitor

#### Query Performance
```sql
-- View slow queries (> 200ms)
SELECT query, calls, mean_exec_time, max_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 200
ORDER BY mean_exec_time DESC
LIMIT 20;
```

Monitor trends:
- [ ] Average query time
- [ ] Query cache hit ratio
- [ ] Slow query count

#### Connection Pool Health
```sql
-- Check current connections
SELECT count(*) FROM pg_stat_activity;

-- Max connections setting
SHOW max_connections;

-- Identify connection leaks
SELECT datname, usename, count(*) FROM pg_stat_activity 
GROUP BY datname, usename
ORDER BY count(*) DESC;
```

#### Table Bloat
```sql
-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;
```

### Set Up Alarms
In Supabase dashboard → Database → Alarms:

| Metric | Threshold | Action |
|--------|-----------|--------|
| CPU usage | > 80% | Email + Slack |
| Memory usage | > 85% | Email + Slack |
| Connections | > 80/100 | Email + Slack |
| Storage | > 80% | Email + Slack |
| Replica lag | > 1 second | Email |

---

## 3. Cloudflare Pages Monitoring

### Dashboard Setup
1. Log in to https://dash.cloudflare.com/pages
2. Select RealSyncDynamics.AI project
3. Navigate to Analytics & Logs

### Key Metrics

#### Traffic
- Requests (daily, weekly, monthly)
- Bandwidth usage
- Cache hit ratio
- Geographic distribution

#### Performance
- Page views by country
- Load times by device type
- Core Web Vitals (if enabled)
- Cache performance

#### Errors
- 4xx error rate
- 5xx error rate (indicates origin errors)
- Error trending

### Create Custom Alerts
```
Condition: Error Rate (5xx) > 1% in last 10 minutes
Webhook: https://hooks.slack.com/services/YOUR/WEBHOOK/URL
Message: "⚠️ High 5xx error rate on realsyncdynamics.ai"
```

---

## 4. Stripe Monitoring

### Configure Webhook Logging
1. Go to Stripe Dashboard → Webhooks
2. Ensure webhook endpoint: `https://api.realsyncdynamics.ai/functions/v1/stripe-webhook`
3. Subscribe to events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`

### Metrics to Track
```
Daily/Weekly Report:
  - Successful charges: $X
  - Failed charges: $Y
  - Refunds issued: $Z
  - Churn rate: A%
  - MRR (Monthly Recurring Revenue): $MRR
```

### Automated Alerts
Configure in Stripe → Settings → Billing settings:
- [ ] Failed payment attempt (automatic retry in 3 days)
- [ ] Invoice payment failure (email customer)
- [ ] Subscription cancellation (email support)
- [ ] Large refund (> €1000)

---

## 5. Application Performance Monitoring (APM)

### Client-Side (Sentry Tracing)
Enable in src/lib/sentry.ts:
```typescript
import { BrowserTracing } from "@sentry/tracing";

Sentry.init({
  // ...
  integrations: [
    new BrowserTracing({
      routingInstrumentation: Sentry.reactRouterV6Instrumentation(
        React.useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes
      ),
    }),
  ],
});
```

### Server-Side (Edge Functions)
Add to each edge function:
```typescript
const transaction = Sentry.startTransaction({
  op: "http.handler",
  name: "POST /stripe-webhook",
});

// ... function logic ...

transaction.end();
```

### Metrics to Track
- **Web Vitals:** LCP, FID, CLS (automatically captured by Sentry)
- **API Latency:** Time from request to response
- **Database queries:** Time spent in database operations
- **Third-party APIs:** Anthropic, Stripe response times

---

## 6. Business Metrics Dashboard

### Setup (Metabase or similar)
Create dashboard with:

**Revenue Metrics:**
- Total MRR by plan tier
- New customers (weekly)
- Churn rate (monthly)
- LTV (Customer Lifetime Value)
- CAC (Customer Acquisition Cost)

**Usage Metrics:**
- Daily active users (DAU)
- Compliance scans per day
- Alerts generated per day
- Webhook events per day
- API requests per day

**Product Metrics:**
- Feature adoption (% using white-label branding, webhooks, etc.)
- User engagement (logins per day)
- Session duration
- Feature usage frequency

**Quality Metrics:**
- Error rate
- Uptime %
- Mean time to recovery (MTTR)
- Customer satisfaction (NPS)

---

## 7. Infrastructure Monitoring

### Uptime Monitoring
Use service like Uptime.com or Pingdom:
```
Monitor: https://realsyncdynamics.ai
Frequency: Every 60 seconds
Locations: EU (recommended), US, Asia
Alert: SMS + Slack on failure
```

### Log Aggregation (Optional: ELK Stack)
If using self-hosted infrastructure:

```bash
# Supabase functions logs
supabase functions get-logs all --limit 1000 > logs.json

# Archive and analyze
cat logs.json | jq '.[] | select(.status_code >= 400)'
```

### Health Check Endpoint
Create in `supabase/functions/health-check/`:
```typescript
// Returns 200 if all systems operational
export async function handler(req: Request) {
  const checks = {
    database: await checkDatabase(),
    anthropic_api: await checkAnthropicAPI(),
    stripe_api: await checkStripeAPI(),
  };

  const allHealthy = Object.values(checks).every(c => c === true);
  return new Response(
    JSON.stringify({ status: allHealthy ? 'ok' : 'degraded', checks }),
    { status: allHealthy ? 200 : 503 }
  );
}
```

Monitor: `https://api.realsyncdynamics.ai/functions/v1/health-check`

---

## 8. Security Monitoring

### Failed Authentication Attempts
```sql
-- Track suspicious login patterns
SELECT 
  email,
  COUNT(*) as attempts,
  MAX(created_at) as last_attempt
FROM auth.audit_log_entries
WHERE event = 'user_login'
  AND status = 'failed'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY email
HAVING COUNT(*) > 5
ORDER BY attempts DESC;
```

Alert if: > 10 failed logins per hour for same user

### API Key Usage Anomalies
Track in `ai_tool_runs` table:
```sql
-- Flag unusual API usage patterns
SELECT 
  user_id,
  COUNT(*) as call_count,
  SUM(cost_tokens) as token_spend
FROM ai_tool_runs
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY user_id
ORDER BY token_spend DESC
LIMIT 10;
```

Alert if: Spend > 5x daily average for user

### RLS Policy Violations
```sql
-- Monitor RLS denials (check Sentry)
SELECT COUNT(*) as denied_count
FROM pg_stat_statements
WHERE query LIKE '%permission denied%'
  AND query_start > NOW() - INTERVAL '1 hour';
```

---

## 9. Alert Routing & Escalation

### Slack Integration
In Sentry:
1. Settings → Integrations → Slack
2. Connect workspace
3. Create alert rules:

```
Rule 1 (P1): Error rate > 5%
  → #critical-alerts (tagged: @on-call-lead)

Rule 2 (P2): Error rate > 1%
  → #alerts

Rule 3 (Info): Deployment successful
  → #deployments
```

### Email Distribution
- P1 incidents → realsyncdynamics-leads@gmail.com + on-call SMS
- P2 incidents → realsyncdynamics-engineers@gmail.com
- Weekly digest → team@realsyncdynamics.ai

### PagerDuty Integration (Optional)
For automatic incident escalation:
1. Create PagerDuty account
2. Create escalation policy (30 min → manager)
3. Connect Sentry to PagerDuty
4. Trigger incidents on P1 events

---

## 10. Monitoring Checklist

### Daily
- [ ] Check Sentry error rate (target: < 1%)
- [ ] Review Slack #alerts channel
- [ ] Monitor API latency (target: p95 < 500ms)

### Weekly
- [ ] Run database health check (table sizes, index usage)
- [ ] Review performance trends (bundle size, LCP)
- [ ] Check security audit logs for anomalies
- [ ] Generate business metrics report

### Monthly
- [ ] Full infrastructure audit (backup verification, capacity planning)
- [ ] Review and update alert thresholds
- [ ] Incident retrospectives (if any)
- [ ] Update documentation based on lessons learned

### Quarterly
- [ ] Security penetration test (external)
- [ ] Capacity planning review
- [ ] Disaster recovery drill (backup restoration)
- [ ] Team training/certification updates

---

## 11. Useful Commands

### Sentry CLI
```bash
# Install
npm install -g @sentry/cli

# Release management
sentry-cli releases create my-app@1.0.0
sentry-cli releases set-commits my-app@1.0.0 --auto

# Sourcemap upload
sentry-cli releases files upload-sourcemaps my-app@1.0.0 ./dist
```

### Supabase Monitoring
```bash
# View logs
supabase functions get-logs dashboard-intelligence --limit 100

# Get function stats
curl -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  https://api.supabase.com/v1/projects/<project-id>/functions

# Database query stats (via psql)
psql -h db.supabase.co -U postgres -c "SELECT * FROM pg_stat_statements LIMIT 10;"
```

### Alert Testing
```bash
# Test Slack webhook
curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK \
  -H 'Content-type: application/json' \
  -d '{"text":"Test alert from RealSyncDynamics"}'

# Test Sentry
Sentry.captureException(new Error("Test error for monitoring"));
```

---

## 12. Monitoring Stack Summary

| Tool | Purpose | Cost | Setup Time |
|------|---------|------|-----------|
| **Sentry** | Error tracking & APM | $29/mo (generous free tier) | 1 hour |
| **Supabase** | Database monitoring | Included | 30 min |
| **Cloudflare Pages** | CDN & analytics | Included | 20 min |
| **Stripe Dashboard** | Payment monitoring | Included | 30 min |
| **Uptime.com** | Uptime monitoring | $10/mo | 15 min |
| **PagerDuty** (optional) | Incident management | $49/mo | 2 hours |

**Total estimated cost:** ~$40-50/mo (without PagerDuty)

---

---

## 13. Phase 4: Social-Orchestrator Persistence Monitoring

### New Components to Monitor

The Phase 4 persistence layer adds four critical database tables and one Edge Function. This section covers monitoring-specific to social media publishing infrastructure.

#### Tables to Monitor
1. `social_dlq_entries` — Dead Letter Queue for failed publishes
2. `social_publishing_metrics` — Time-series publishing events
3. `social_publishing_metrics_hourly` — Aggregated hourly metrics
4. `social_audit_log` — Compliance audit trail

#### Edge Function to Monitor
- `social-orchestrator-persistence` — Handles 8 operations (DLQ, metrics, audit)

### 13.1 SQL Monitoring Views (Phase 4)

Execute in Supabase SQL Editor to create Phase 4-specific monitoring views:

```sql
-- View 1: Real-time DLQ Status by Channel
CREATE OR REPLACE VIEW monitoring.dlq_channel_status AS
SELECT
  channel,
  COUNT(*) as total_entries,
  COUNT(CASE WHEN next_retry_at IS NULL THEN 1 END) as max_retries_reached,
  COUNT(CASE WHEN next_retry_at <= NOW() THEN 1 END) as ready_to_retry,
  COUNT(CASE WHEN error_code = 'RATE_LIMIT' THEN 1 END) as rate_limit_errors,
  COUNT(CASE WHEN error_code = 'UNAUTHORIZED' THEN 1 END) as auth_errors,
  COUNT(CASE WHEN error_code = 'NETWORK_TIMEOUT' THEN 1 END) as timeout_errors,
  MAX(retry_count) as max_retry_attempts,
  AVG(retry_count) as avg_retry_attempts,
  MAX(updated_at) as last_updated
FROM social_dlq_entries
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY channel
ORDER BY total_entries DESC;

-- View 2: Publishing Metrics - Hourly Rollup Status
CREATE OR REPLACE VIEW monitoring.metrics_rollup_health AS
SELECT
  hour,
  channel,
  total_attempts,
  succeeded,
  failed,
  ROUND(error_rate, 2) as error_rate_percent,
  ROUND(avg_latency_ms, 2) as avg_latency_ms,
  ROUND(p95_latency_ms, 2) as p95_latency_ms,
  ROUND(p99_latency_ms, 2) as p99_latency_ms,
  (NOW() - (hour + INTERVAL '1 hour'))::TEXT as age_since_hour_end
FROM social_publishing_metrics_hourly
WHERE hour > NOW() - INTERVAL '24 hours'
ORDER BY hour DESC, channel;

-- View 3: DLQ Retry Backoff Schedule
CREATE OR REPLACE VIEW monitoring.dlq_retry_schedule AS
SELECT
  id,
  queue_entry_id,
  channel,
  error_code,
  retry_count,
  next_retry_at,
  EXTRACT(EPOCH FROM (next_retry_at - NOW()))::INTEGER as seconds_until_retry,
  EXTRACT(EPOCH FROM (NOW() - created_at))::INTEGER as age_seconds
FROM social_dlq_entries
WHERE next_retry_at IS NOT NULL
ORDER BY next_retry_at ASC
LIMIT 100;

-- View 4: Audit Log Summary
CREATE OR REPLACE VIEW monitoring.audit_summary AS
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  event_type,
  COUNT(*) as event_count,
  COUNT(DISTINCT channel) as affected_channels
FROM social_audit_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at), event_type
ORDER BY hour DESC;

-- View 5: Error Code Distribution (24h)
CREATE OR REPLACE VIEW monitoring.error_distribution AS
SELECT
  error_code,
  COUNT(*) as count,
  COUNT(DISTINCT channel) as affected_channels,
  ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM social_dlq_entries WHERE created_at > NOW() - INTERVAL '24 hours'), 2) as percent_of_dlq
FROM social_dlq_entries
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY error_code
ORDER BY count DESC;
```

### 13.2 Dashboard Queries for Phase 4

Use these in your admin monitoring dashboard:

```sql
-- KPI 1: System Health Snapshot
SELECT
  (SELECT COUNT(*) FROM social_dlq_entries) as dlq_depth,
  (SELECT COUNT(*) FROM social_dlq_entries WHERE created_at > NOW() - INTERVAL '1 hour') as dlq_new_1h,
  (SELECT COUNT(*) FROM social_publishing_metrics WHERE created_at > NOW() - INTERVAL '1 hour' AND status = 'failed') as failed_1h,
  (SELECT COUNT(*) FROM social_publishing_metrics WHERE created_at > NOW() - INTERVAL '1 hour' AND status = 'succeeded') as succeeded_1h,
  (SELECT COUNT(*) FROM social_dlq_entries WHERE next_retry_at IS NOT NULL AND next_retry_at <= NOW()) as ready_retry_now
  NOW() as timestamp;

-- KPI 2: Error Rate by Channel (Last 24h)
SELECT
  channel,
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
  ROUND(100.0 * COUNT(CASE WHEN status = 'failed' THEN 1 END) / COUNT(*), 2) as error_rate_percent,
  ROUND(AVG(latency_ms), 2) as avg_latency_ms,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms), 2) as p95_latency_ms
FROM social_publishing_metrics
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY channel
ORDER BY error_rate_percent DESC;

-- KPI 3: Top DLQ Error Types (Last 7 Days)
SELECT
  error_code,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM social_dlq_entries WHERE created_at > NOW() - INTERVAL '7 days'), 2) as percent
FROM social_dlq_entries
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY error_code
ORDER BY count DESC;

-- KPI 4: DLQ Stuck Entries (Max Retries Reached)
SELECT
  id,
  queue_entry_id,
  channel,
  error_code,
  retry_count,
  EXTRACT(EPOCH FROM (NOW() - created_at))::INTEGER as stuck_for_seconds,
  EXTRACT(EPOCH FROM (NOW() - created_at))::INTEGER / 86400 as stuck_for_days
FROM social_dlq_entries
WHERE next_retry_at IS NULL AND retry_count >= 5
ORDER BY created_at ASC;

-- KPI 5: Cron Job Execution Frequency (Last 24h)
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as event_count
FROM social_audit_log
WHERE event_type IN ('dlq_cleanup_executed', 'metrics_rollup_executed')
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;
```

### 13.3 Alert Thresholds for Phase 4

| Metric | Warning Threshold | Critical Threshold | Action |
|--------|-------------------|-------------------|--------|
| DLQ Depth | > 10 entries | > 100 entries | Investigate root cause, check channel logs |
| Error Rate (1h) | > 2% | > 5% | Pause new publishes, investigate channel |
| P95 Latency | > 3 seconds | > 5 seconds | Check Edge Function logs, DB load |
| Stuck DLQ Entries | > 5 | > 20 | Manual intervention, potential data loss risk |
| Failed Rollup Job | Any miss | 2 consecutive misses | Check pg_cron, verify maintenance function |
| Audit Log Lag | > 100ms | > 500ms | Database performance issue |

### 13.4 Sentry Configuration for Phase 4

In `supabase/functions/social-orchestrator-persistence/index.ts`:

```typescript
import * as Sentry from '@sentry/serverless';

Sentry.init({
  dsn: Deno.env.get('SENTRY_DSN'),
  environment: Deno.env.get('ENVIRONMENT') || 'staging',
  integrations: [new Sentry.Integrations.Postgres()],
  tracesSampleRate: 1.0,
});

// Tag each operation
export async function handleDLQOperation(action, params) {
  const span = Sentry.startTransaction({
    op: 'dlq.operation',
    name: `dlq:${action}`,
  });
  
  try {
    // ... operation logic ...
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        operation: `dlq:${action}`,
        channel: params.channel,
        error_code: params.error_code,
      },
    });
    throw error;
  } finally {
    span.finish();
  }
}
```

### 13.5 Production Dashboards for Phase 4

Create these custom dashboards in your admin panel:

**Dashboard 1: DLQ Health**
- Total DLQ depth
- DLQ entries added in last 1h, 24h, 7d
- Entries ready for retry now
- Error type breakdown (pie chart)
- Retry backoff schedule (histogram)

**Dashboard 2: Publishing Performance**
- Success/failure rate by channel (last 24h)
- Latency distribution (p50, p95, p99)
- Throughput (publishes/hour by channel)
- Error rate trend (24h line chart)

**Dashboard 3: Operational Health**
- Cron job execution status (cleanup, rollup)
- Audit log event volume (hourly)
- Stuck DLQ entries (age distribution)
- Database table sizes (social_* tables)

**Dashboard 4: Audit Compliance**
- Recent audit events (paginated list)
- Event types distribution (24h)
- Events by channel and outcome
- Compliance trail for specific queue_id

### 13.6 Monitoring During Staging Tests

Checklist for monitoring during STAGING_TEST_GUIDE.md execution:

```
Before Testing:
  [ ] DLQ is empty (COUNT(*) = 0)
  [ ] Metrics tables are recent (< 1 hour old data)
  [ ] Audit log shows successful cron execution
  [ ] Edge Function logs are clean

During Test Suite 1 (Basic Publishing):
  [ ] Monitor DLQ: Should stay empty for successful publishes
  [ ] Monitor metrics: Each publish should create 1 row
  [ ] Latency: Should be < 5 seconds per channel
  [ ] Audit log: Should show publish_attempted → publish_succeeded

During Test Suite 2 (Failure Scenarios):
  [ ] Rate limit: DLQ entry created with error_code='RATE_LIMIT'
  [ ] Auth error: DLQ entry created with error_code='UNAUTHORIZED'
  [ ] Timeout: DLQ entry created with error_code='NETWORK_TIMEOUT'
  [ ] Verify next_retry_at follows exponential backoff (60s, 120s, 240s...)

During Test Suite 3 (Metrics):
  [ ] Hourly rollup: Wait 1 hour, check social_publishing_metrics_hourly
  [ ] Error rate: Should match manual count calculation
  [ ] Audit trail: Complete event sequence for single publish

After All Tests:
  [ ] No orphaned DLQ entries (all retried successfully)
  [ ] Database size reasonable (< 100MB for test data)
  [ ] No slow queries in pg_stat_statements
  [ ] All cron jobs executed successfully
```

### 13.7 Post-Launch Monitoring Routine

**Hourly** (automated alert check):
```sql
-- Run this query hourly to spot trends
SELECT
  'last_hour' as period,
  (SELECT COUNT(*) FROM social_dlq_entries WHERE created_at > NOW() - INTERVAL '1 hour') as new_dlq,
  (SELECT ROUND(100.0 * COUNT(CASE WHEN status = 'failed' THEN 1 END) / COUNT(*), 2) 
   FROM social_publishing_metrics WHERE created_at > NOW() - INTERVAL '1 hour') as error_rate_percent,
  (SELECT MAX(latency_ms) FROM social_publishing_metrics WHERE created_at > NOW() - INTERVAL '1 hour') as max_latency_ms;
```

**Daily** (manual review):
- [ ] Check Sentry for new Edge Function errors
- [ ] Review DLQ by error type (any new patterns?)
- [ ] Verify cron jobs ran (cleanup, rollup)
- [ ] Spot check latency trends

**Weekly** (detailed analysis):
- [ ] Generate performance report (error rates, latency by channel)
- [ ] Analyze DLQ patterns (which channels fail most?)
- [ ] Review stuck entries (manual intervention needed?)
- [ ] Check database size growth

**Monthly** (operational review):
- [ ] Archive old audit logs if quota constrained
- [ ] Analyze channel performance trends
- [ ] Optimize indexes if queries slow
- [ ] Plan retention policy adjustments

---

**Last Updated:** 2026-07-19  
**Status:** Ready for Production  
**Next Review:** Monthly during operations
