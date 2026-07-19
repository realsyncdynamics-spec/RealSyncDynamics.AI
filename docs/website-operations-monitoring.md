# Website Operations Layer — Monitoring & Observability

**Status:** Phase 8 Implementation Guide  
**Updated:** 2026-07-17

---

## Overview

Comprehensive monitoring strategy for Website Operations Layer production system. Covers error tracking, performance metrics, alerting thresholds, and observability best practices.

---

## 1. Sentry Error Tracking

### Configuration

```typescript
// src/lib/sentry.ts
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: process.env.VITE_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  integrations: [
    new Sentry.Replay({ maskAllText: false }),
    new Sentry.Breadcrumbs(),
  ],
  tracesSampleRate: 0.1,      // 10% of transactions
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

### Error Tagging

```typescript
// Consistent error tagging for routing
try {
  await generateWebsite(projectId);
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      'service': 'website-operations',
      'feature': 'generation',
      'severity': 'high',
      'phase': 'ai-generation',
    },
    contexts: {
      'operation': {
        'project_id': projectId,
        'industry': industry,
        'timestamp': new Date().toISOString(),
      },
    },
    level: 'error',
  });
}
```

### Dashboard Queries

**All website operations errors:**
```
error.type: "Error" AND service: "website-operations"
ORDER BY timestamp DESC
LIMIT 100
```

**By severity:**
```
service: "website-operations" AND severity: "high"
OVER last 24 hours
GROUP BY feature
```

**By phase:**
```
service: "website-operations" AND phase: ("ai-generation" OR "deployment" OR "compliance")
TIMESERIES
```

---

## 2. Error Rate Thresholds & Alerts

### Alerting Configuration

| Operation | Error Rate | Window | Action |
|-----------|-----------|--------|--------|
| `website-generation` | 5% | 5 min | DEGRADE (use template fallback) |
| `cloudflare-deploy` | 10% | 10 min | ALERT (page on-call) |
| `domain-propagation` | 15% | 30 min | RETRY (exponential backoff) |
| `compliance-scan` | 3% | 15 min | ALERT |
| `maintenance-run` | 2% | 1 hour | MONITOR |

### Sentry Alert Rules

**High Priority Alerts:**
```
Rule: "Website Generation Rate Exceeds 5%"
Condition: error.type = "GENERATION_ERROR" AND count > 100 over 5 min
Action: Notify #platform-incidents (PagerDuty)

Rule: "Cloudflare Deployment Failures"
Condition: error.context.feature = "deployment" AND count > 20 over 10 min
Action: Notify #platform-incidents (PagerDuty page on-call)

Rule: "Database Connection Pool Exhaustion"
Condition: error.message ~= "connection pool" AND count > 5 over 2 min
Action: Auto-escalate + notify CTO
```

**Low Priority Alerts:**
```
Rule: "Input Validation Errors"
Condition: error.context.severity = "low" AND count > 500 over 1 hour
Action: Daily digest email to product team
```

---

## 3. Performance Metrics

### Key Metrics to Track

**Generation Performance:**
- Generation time (P50, P95, P99)
- Token count (correlation with latency)
- Success rate by industry
- Retry count distribution

**Deployment Performance:**
- Deployment time (Pages upload)
- Cloudflare API response time
- R2 bucket performance
- DNS propagation time

**Database Performance:**
- Query execution time (P95/P99)
- Connection pool utilization
- RLS policy overhead
- Index effectiveness

### PerformanceMonitor Implementation

```typescript
import { globalPerformanceMonitor } from '@/lib/error-monitor';

// Wrap operations
await globalPerformanceMonitor.measure(
  'website-generation',
  () => generateWebsite(projectId)
);

// Check statistics
const stats = globalPerformanceMonitor.getStats('website-generation');
// { count: 150, mean: 8234.5, min: 5000.2, max: 45000.8, p95: 15000.3, p99: 35000.1 }
```

### Dashboard Visualizations

**Generation Performance:**
```
Line chart: Average generation time over 24 hours
Y-axis: Time (ms)
X-axis: Time (hourly)
Overlay: Error rate line
```

**Error Rate Trends:**
```
Stacked area chart: Error rate by type
- Input validation
- AI timeout
- Database error
- Cloudflare error
- Other
```

**Circuit Breaker States:**
```
Time series: Circuit breaker state transitions
Annotations: Alert triggers, recovery events
```

---

## 4. Distributed Tracing

### Request Context Propagation

```typescript
// Generate unique request ID
const requestId = generateRequestId();

// Pass through headers in all calls
const headers = {
  'X-Request-ID': requestId,
  'X-Function-Name': 'website-operations-agent',
  'X-User-ID': userId,
  'X-Tenant-ID': tenantId,
};

// Edge Function receives and logs
console.log(`[${requestId}] Starting generation for project ${projectId}`);
```

### Trace ID in Sentry

```typescript
Sentry.captureException(error, {
  contexts: {
    'trace': {
      'trace_id': requestId,
      'span_id': generateSpanId(),
      'parent_span_id': parentSpanId,
    },
  },
});
```

---

## 5. Custom Metrics

### Metric Definition Pattern

```typescript
interface CustomMetric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'distribution';
  tags: Record<string, string>;
  value: number;
  unit: string;
  timestamp: number;
}

// Send to Sentry or external monitoring service
function captureMetric(metric: CustomMetric) {
  Sentry.captureMessage(`metric.${metric.name}`, 'info', {
    contexts: { metric },
  });
}
```

### Website Operations Metrics

| Metric | Type | Description | Alert Threshold |
|--------|------|-------------|-----------------|
| `website.generation.duration_ms` | Histogram | Time to generate website | P95 > 15000 |
| `website.generation.success` | Counter | Successful generations | Rate < 95% |
| `website.generation.retry_count` | Distribution | Retry attempts | Mean > 1.5 |
| `website.deployment.duration_ms` | Histogram | Time to deploy | P95 > 120000 |
| `website.domain.propagation_time_ms` | Histogram | DNS propagation time | P95 > 300000 |
| `website.compliance.scan_duration_ms` | Histogram | Compliance scan time | P95 > 30000 |
| `circuit_breaker.state` | Gauge | Circuit breaker status | Open > 5 min |
| `rate_limiter.tokens_remaining` | Gauge | Rate limit tokens | < 20% of max |

---

## 6. Health Checks

### Endpoint-Level Health

```typescript
// GET /health/website-operations
export async function healthCheckWebsiteOperations() {
  return {
    status: 'healthy',
    timestamp: Date.now(),
    services: {
      anthropic: { status: 'ok', latency_ms: 150 },
      supabase: { status: 'ok', latency_ms: 45 },
      cloudflare: { status: 'ok', latency_ms: 280 },
    },
    circuitBreaker: {
      'website-generation': 'closed',
      'cloudflare-deploy': 'closed',
      'domain-manager': 'half-open',
    },
    rateLimiter: {
      'website-generation': { remaining: 8 },
      'domain-manager': { remaining: 12 },
    },
  };
}
```

### Synthetic Monitoring

```bash
# Automated health check every 5 minutes
0 */5 * * * curl -f https://api.example.com/health/website-operations

# Daily end-to-end test
0 2 * * * ./scripts/e2e-test.sh --skip-ui
```

---

## 7. Logging Best Practices

### Structured Logging

```typescript
// Always include context in logs
logOperation('info', 'Website generation started', {
  userId,
  tenantId,
  functionName: 'website-operations-agent',
  requestId,
}, {
  projectId,
  industry,
  companyName,
  timestamp: Date.now(),
});

// Output (JSON):
// {"level":"info","timestamp":"2026-07-17T...","message":"Website generation started","context":{...},"meta":{...}}
```

### Log Aggregation

Configure CloudWatch/ELK/DataDog to ingest:
- Sentry errors
- Edge Function logs
- Application logs
- Database slow queries

### Log Retention

| Log Type | Retention | Sampling |
|----------|-----------|----------|
| Errors | 90 days | 100% |
| Warnings | 30 days | 100% |
| Info | 14 days | 50% |
| Debug | 7 days | 10% |

---

## 8. On-Call Playbook

### Alert Routing

**High Severity (P1):**
- Immediate PagerDuty page
- Slack #platform-incidents
- Auto-escalate after 15 minutes

**Medium Severity (P2):**
- Slack notification
- On-call review within 1 hour
- Auto-escalate after 4 hours

**Low Severity (P3):**
- Slack notification
- Review during business hours
- Auto-close after 72 hours if not acknowledged

### Investigation Template

```markdown
## Incident: [NAME]
- **Severity:** P1/P2/P3
- **Detected:** [Timestamp]
- **Duration:** [Minutes]
- **Impact:** [Description]

## Quick Checks
- [ ] Check Sentry for recent errors
- [ ] Check circuit breaker status
- [ ] Check database connection pool
- [ ] Check Cloudflare status page

## Diagnosis
[Step-by-step findings]

## Resolution
[Actions taken]

## Root Cause
[Analysis]

## Prevention
[Follow-up items]
```

---

## 9. Monitoring Dashboard (Grafana)

### Dashboard Panels

**Panel 1: System Health**
- Service status (Anthropic, Supabase, Cloudflare)
- Circuit breaker states
- Database connection pool %

**Panel 2: Error Metrics**
- Error rate (5-min rolling)
- Errors by type (stacked area)
- Top errors (table)

**Panel 3: Performance**
- Generation time (P50/P95/P99)
- Deployment time (P50/P95/P99)
- Database query time (P95/P99)

**Panel 4: Volume**
- Generations per hour
- Deployments per hour
- Compliance scans per hour

**Panel 5: Rate Limits**
- Current utilization %
- Tokens remaining
- Throttling events

---

## 10. Runbook Integration

Every alert should link to relevant runbook:

```
Circuit breaker open → Runbook: [Website Generation Failure]
SSL provisioning stuck → Runbook: [Domain SSL Not Provisioning]
Cloudflare error → Runbook: [Cloudflare Deployment Stuck]
Rate limit exceeded → Runbook: [Rate Limit Exceeded]
```

---

## Summary

**Core Principles:**
1. ✅ Fast detection (< 5 minutes)
2. ✅ Clear root cause (structured logs)
3. ✅ Automated remediation (circuit breaker, retry)
4. ✅ Human escalation (runbooks, playbooks)
5. ✅ Continuous improvement (metrics → prevention)

**Next Steps:**
- [ ] Set up Sentry project + API key
- [ ] Configure Grafana dashboards
- [ ] Create PagerDuty escalation policy
- [ ] Train ops team on runbooks
- [ ] Set up synthetic monitoring
- [ ] Implement log aggregation

---

**Owner:** Platform Team  
**Review Date:** 2026-08-17
