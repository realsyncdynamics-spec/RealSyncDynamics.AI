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

**Last Updated:** 2026-07-06  
**Status:** Ready for Production  
**Next Review:** Monthly during operations
