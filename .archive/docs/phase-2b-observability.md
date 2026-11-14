# Phase 2b Step 4: Observability & Monitoring Setup

**Status**: Ready for Staging Deployment | **Timeline**: Days 13-21

**Objective**: Real-time monitoring of Cloudflare Workers performance with automated alerting for Phase 2b metrics.

---

## Architecture Overview

### Data Flow

```
Cloudflare Workers
    ├─ Request Handler
    │  └─ captureAnalytics() → Cloudflare Analytics Engine
    │  └─ Sentry.captureException() → Sentry
    │  └─ X-Worker-Latency header → Client
    │
├─ Cloudflare Analytics Engine (Custom Metrics)
│  └─ SQL Queries for dashboards
│  └─ Real-time aggregation
│  └─ 31-day retention
│
└─ Sentry
   ├─ Error tracking
   ├─ Performance monitoring (Spans)
   └─ Alert rules
```

### Metrics Collected

**Per-Request**:
- Endpoint path (`/api/auth/verify-jwt`, `/api/policies/*`, etc.)
- HTTP method (GET, POST, DELETE)
- Response status code (200, 401, 404, 500, etc.)
- Latency in milliseconds
- Cache status (HIT, MISS, N/A)
- Error type (if any)
- Tenant ID (multi-tenant context)

**On Error**:
- Exception type and message
- Stack trace (sampled)
- Request context (URL, method, headers)
- Tag: handler name, tenant_id
- Breadcrumbs (recent operations)

---

## Setup: Cloudflare Analytics Engine

### Step 1: Enable Analytics Engine Binding

**wrangler-workers.toml**:
```toml
[env.production]
analytics_engine = true

[[env.production.kv_namespaces]]
binding = "ANALYTICS_ENGINE"
```

### Step 2: Configure Metrics Collection

Workers automatically buffer and send metrics to Cloudflare's Analytics Engine. No additional setup required—metrics flow automatically when `captureAnalytics()` is called.

### Step 3: Query Metrics via GraphQL

```graphql
query {
  viewer {
    zones(filter: {zoneTag: "realsyncdynamicsai.de"}) {
      analyticsEngine {
        query(sql: "SELECT COUNT(*) as requests FROM Httplog WHERE Timestamp > now() - interval '1 hour'")
      }
    }
  }
}
```

---

## Setup: Sentry Integration

### Step 1: Create Sentry Project

1. Log into [sentry.io](https://sentry.io)
2. Create new project: "RealSyncDynamics Workers"
3. Select platform: **JavaScript (or Node.js)**
4. Copy DSN: `https://xxxxxxxx@sentry.io/12345678`

### Step 2: Configure Environment Variable

```bash
# In Cloudflare Pages/Workers secrets
wrangler secret put SENTRY_DSN
# Paste: https://xxxxxxxx@sentry.io/12345678
```

### Step 3: Verify Sentry Integration

```bash
# Test error capture
curl -X POST https://workers.realsyncdynamicsai.de/api/auth/verify-jwt \
  -H "Authorization: Bearer invalid-token"

# Check Sentry dashboard for error event
```

---

## Monitoring Dashboards

### Dashboard 1: Workers Performance (Real-Time)

**Metrics**:
- JWT verification: p50/p95/p99 latency
- KV cache: hit rate %, p95 latency (hits vs. misses)
- R2 evidence: write latency p95, success rate
- Overall error rate

**Query** (Cloudflare Analytics Engine):
```sql
SELECT
  endpoint,
  COUNT(*) as request_count,
  QUANTILE(latency_ms, 0.50) as p50,
  QUANTILE(latency_ms, 0.95) as p95,
  QUANTILE(latency_ms, 0.99) as p99,
  SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) / COUNT(*) as error_rate
FROM Httplog
WHERE Timestamp > now() - interval '1 hour'
GROUP BY endpoint
ORDER BY p95 DESC
```

**Update Frequency**: Real-time (every 10 seconds)

### Dashboard 2: Cache Efficiency (30-Day Trend)

**Metrics**:
- KV hit rate daily trend
- Cache eviction rate
- Popular policies (top 10)

**Query**:
```sql
SELECT
  DATE_TRUNC(hour, Timestamp) as hour,
  SUM(CASE WHEN CacheStatus = 'HIT' THEN 1 ELSE 0 END) / COUNT(*) as hit_rate,
  COUNT(*) as total_requests
FROM Httplog
WHERE Endpoint LIKE '/api/policies/%'
  AND Timestamp > now() - interval '30 days'
GROUP BY DATE_TRUNC(hour, Timestamp)
ORDER BY hour DESC
```

**Update Frequency**: Hourly aggregation

### Dashboard 3: Error Tracking (Sentry)

**Metrics**:
- Error rate by endpoint
- Top 10 errors (by frequency)
- Error trend (24h window)
- Error resolution time

**Filters**:
```
handler:verify-jwt OR handler:kv-cache OR handler:evidence-vault
```

**Update Frequency**: Real-time (new events trigger alerts)

### Dashboard 4: Multi-Tenant Isolation (Compliance)

**Metrics**:
- Cache hits/misses per tenant
- Error rate by tenant
- Verify no cross-tenant cache collisions

**Query**:
```sql
SELECT
  TenantId,
  COUNT(*) as total_requests,
  SUM(CASE WHEN CacheStatus = 'HIT' THEN 1 ELSE 0 END) / COUNT(*) as hit_rate,
  SUM(CASE WHEN StatusCode >= 400 THEN 1 ELSE 0 END) / COUNT(*) as error_rate
FROM Httplog
WHERE Timestamp > now() - interval '1 hour'
GROUP BY TenantId
ORDER BY total_requests DESC
```

---

## Alert Configuration

### Alert 1: JWT Error Rate >1%

**Condition**: Error rate on `/api/auth/verify-jwt` exceeds 1% for 5 minutes

**Sentry Rule**:
```json
{
  "action": "alert_on_error_rate",
  "percentage": 1,
  "timeframe_minutes": 5,
  "tags": { "handler": "verify-jwt" },
  "notifications": ["pagerduty", "slack:#engineering"]
}
```

**Response**: Page on-call engineer
**Severity**: Critical
**Expected Response Time**: <5 minutes

### Alert 2: KV Cache Hit Rate <70%

**Condition**: Cache hit rate drops below 70% for 15 minutes (cache churn)

**Cloudflare Alert**:
```sql
-- Query runs every 5 minutes
SELECT
  SUM(CASE WHEN CacheStatus = 'HIT' THEN 1 ELSE 0 END) / COUNT(*) as hit_rate
FROM Httplog
WHERE Endpoint LIKE '/api/policies/%'
  AND Timestamp > now() - interval '15 minutes'

-- If hit_rate < 0.70: trigger alert
```

**Response**: Investigate cache evictions, check for policy updates
**Severity**: Warning
**Expected Response Time**: <30 minutes

### Alert 3: R2 Write Failures >5 in 5 Minutes

**Condition**: Evidence vault dual-write failures spike

**Sentry Rule**:
```json
{
  "action": "alert_on_error_count",
  "count": 5,
  "timeframe_minutes": 5,
  "tags": { "handler": "evidence-vault" },
  "notifications": ["pagerduty"]
}
```

**Response**: Check R2 bucket status, verify Supabase RLS
**Severity**: Critical (evidence at risk)
**Expected Response Time**: <5 minutes

### Alert 4: Supabase RLS Denials >10 in 1 Minute

**Condition**: Sudden spike in RLS policy violations

**Sentry Rule**:
```json
{
  "action": "alert_on_error_count",
  "count": 10,
  "timeframe_minutes": 1,
  "error_type": "rls_denial",
  "notifications": ["slack:#security"]
}
```

**Response**: Review recent RLS policy changes
**Severity**: Warning (security)
**Expected Response Time**: <15 minutes

### Alert 5: Webhook Secret Failures >20 in 5 Minutes

**Condition**: Cache invalidation webhooks failing (possible attack)

**Sentry Rule**:
```json
{
  "action": "alert_on_error_count",
  "count": 20,
  "timeframe_minutes": 5,
  "error_type": "webhook_auth_failed",
  "notifications": ["pagerduty", "slack:#security"]
}
```

**Response**: Verify webhook secret, check for auth issues
**Severity**: Critical (cache poisoning risk)
**Expected Response Time**: <5 minutes

---

## Performance Baselines

### JWT Verification

| Percentile | Target | Baseline (Measured) |
|-----------|--------|------------------|
| p50 | <30ms | 5-10ms |
| p95 | <50ms | 15-25ms |
| p99 | <100ms | 20-40ms |

### KV Cache

| Metric | Target | Baseline |
|--------|--------|----------|
| Hit latency p95 | <20ms | 8-15ms |
| Miss latency p95 | <1000ms | 300-800ms |
| Hit rate (warm) | >80% | 85-92% |
| Invalidation p95 | <50ms | 10-30ms |

### R2 Evidence

| Metric | Target | Baseline |
|--------|--------|----------|
| Dual-write latency p95 | <500ms | 100-300ms |
| R2 write latency p95 | <100ms | 50-80ms |
| Supabase write latency p95 | <500ms | 200-400ms |
| Success rate | >99% | 99.5% |

---

## Sentry Configuration (wrangler-workers.toml)

```toml
[env.production]
env = { SENTRY_DSN = "https://key@sentry.io/12345" }

# Performance monitoring
[env.production.env.sentry]
traces_sample_rate = 0.1  # Sample 10% of transactions in prod
debug = false
environment = "production"
max_breadcrumbs = 50
```

---

## Manual Monitoring

### Daily Health Check (Once per day)

```bash
# Check error rate in last 24h
curl -s "https://api.cloudflare.com/client/v4/..." | jq '.result.error_rate'

# Check cache hit rate
curl -s "..." | jq '.result.cache_hit_rate'

# Check Sentry error count
curl -s "https://sentry.io/api/0/organizations/realsyncdynamics/stats/" \
  -H "Authorization: Bearer $SENTRY_AUTH_TOKEN"
```

### Weekly Performance Review (Every Monday)

1. Check [Cloudflare Analytics Dashboard](https://dash.cloudflare.com/)
   - JWT latency trend (should be stable <50ms p95)
   - Cache hit rate trend (should climb above 80%)
   - Error rate trend (should be <0.5%)

2. Check [Sentry Dashboard](https://sentry.io/)
   - Top 10 errors (any new patterns?)
   - Error rate trend
   - Performance spans (slow operations)

3. Review [Slack Alerts](#alert-notification-channels)
   - Any pagerduty pages in last 7 days?
   - False positive alerts (need tuning?)

### Monthly Capacity Planning

```sql
-- Estimate storage growth for R2 evidence
SELECT
  DATE_TRUNC(day, Timestamp) as day,
  COUNT(*) as evidence_events,
  COUNT(*) * 2048 / 1024 / 1024 as estimated_gb_per_day -- assume 2KB/event
FROM Httplog
WHERE Endpoint LIKE '/api/evidence/ingest/%'
  AND Timestamp > now() - interval '30 days'
GROUP BY DATE_TRUNC(day, Timestamp)
ORDER BY day DESC

-- Forecast 90-day archival costs
-- Hot (90d): X GB * $0.015/GB/month
-- Archive (1825d): Y GB * $0.004/GB/month
```

---

## Alert Notification Channels

### PagerDuty (Critical)

- JWT error rate >1%
- R2 write failures >5/5min
- Webhook secret failures >20/5min

**Escalation**: Page on-call → Manager (15 min) → VP Eng (30 min)

### Slack (#engineering)

- KV cache hit rate <70%
- Deploy notifications

**Format**: `⚠️ KV Cache Alert: hit rate dropped to 65% (target: >80%)`

### Slack (#security)

- Supabase RLS denials >10/min
- Webhook secret failures >20/5min

**Format**: `🔒 Security Alert: [type] - [count] events in [timeframe]`

---

## Testing Alerts

### Test Email Alert

```bash
# Trigger a test error in Workers
curl -X POST https://workers.realsyncdynamicsai.de/api/auth/verify-jwt \
  -H "Authorization: Bearer invalid"

# Check Sentry immediately
# (Alert should trigger within 1 minute if configured)
```

### Load Test for Baseline

```bash
# Run k6 load tests to establish performance baseline
k6 run scripts/k6-verify-jwt-load.js --vus 50 --duration 5m

# Baseline metrics saved to baseline.json
# Compare staging vs. production metrics
```

---

## Troubleshooting

### "Analytics Engine not available"

**Cause**: Binding not configured in wrangler.toml
**Fix**: Add `analytics_engine = true` to `[env.production]`

### Sentry events not appearing

**Cause**: DSN not set or network blocked
**Fix**:
```bash
wrangler secret put SENTRY_DSN
# (re-enter DSN)
wrangler publish --env production
```

### High false-positive alert rate

**Action**: Adjust thresholds based on 7-day baseline
- Hit rate: If baseline is 75%, set threshold to 70% (not 80%)
- Error rate: If baseline is 0.2%, set threshold to 1% (not 0.5%)

### "Webhook secret failures" alert spamming

**Cause**: Cache invalidation secrets not configured or rotated
**Fix**:
```bash
# Rotate webhook secret
wrangler secret put CACHE_WEBHOOK_SECRET
# Update .env in all systems that call invalidation endpoints
```

---

## Runbook: Response Procedures

### JWT Error Rate Spike

**Alert**: Error rate >1% for 5 minutes

1. Check Sentry for error type (signature validation? token parsing?)
2. Verify `SUPABASE_JWT_SECRET` hasn't changed
3. Check if Supabase token format changed (new aal claim?)
4. If fixable: Deploy fix, otherwise escalate to Supabase support

### Cache Hit Rate Drops

**Alert**: Hit rate <70% for 15 minutes

1. Check recent policy updates (invalidation trigger working?)
2. Verify KV namespace still exists (not deleted)
3. Check if Supabase RLS policies changed (evicting old cache?)
4. Manually warm cache: Deploy cache-preload Worker

### R2 Write Failure Spike

**Alert**: >5 failures in 5 minutes

1. Check Cloudflare R2 status page
2. Verify `EVIDENCE_VAULT` bucket exists and is writable
3. Check Supabase RLS: are writes being denied?
4. If Supabase: disable Supabase writes (R2 is primary)
5. File incident with Cloudflare R2 support

---

## References

- [Cloudflare Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/)
- [Sentry Cloudflare Workers](https://docs.sentry.io/platforms/javascript/guides/cloudflare-workers/)
- [Phase 2b Observability Code](../src/workers/observability.ts)

