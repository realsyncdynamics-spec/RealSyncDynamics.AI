# Website Operations Phase 8 — Production Hardening & Monitoring

**Status:** Planning  
**Target Date:** 2026-07-20  
**Estimated Duration:** 2-3 days

---

## Overview

Phase 8 focuses on production readiness: error rate monitoring, graceful degradation, rate limiting enforcement, security hardening, and operational runbooks. This phase transforms the feature-complete code into a production-hardened system.

---

## Objectives

1. **Error Handling & Recovery** — Implement circuit breakers, retry logic, graceful degradation
2. **Rate Limiting** — Enforce API rate limits, queue management, backoff strategies
3. **Security Hardening** — RLS policy validation, secrets management, input sanitization
4. **Monitoring & Alerting** — Sentry integration, error thresholds, anomaly detection
5. **Performance Optimization** — Connection pooling, caching, batch operations
6. **Documentation** — Runbooks, troubleshooting guides, ops procedures

---

## 1. Error Handling & Recovery

### 1.1 Circuit Breaker Pattern

**Files to create:**
- `src/lib/circuit-breaker.ts` — Circuit breaker implementation

**Scope:**
```typescript
// Wrap Edge Function calls with circuit breaker
interface CircuitBreakerConfig {
  failureThreshold: number;      // 5 consecutive failures
  successThreshold: number;       // 2 successes to close
  timeout: number;                // 60s before retry
  fallbackFn?: () => Promise<any>;
}

class CircuitBreaker {
  call(fn: () => Promise<any>): Promise<any>;
  reset(): void;
  getState(): 'closed' | 'open' | 'half-open';
}
```

**Usage:**
```typescript
const cloudflareDeployer = new CircuitBreaker(
  () => callEdgeFunction('cloudflare-deployer'),
  { failureThreshold: 3, fallbackFn: () => ({ cached: true }) }
);
```

### 1.2 Retry Logic with Exponential Backoff

**Files to update:**
- `supabase/functions/website-operations-agent/index.ts`
- `supabase/functions/cloudflare-deployer/index.ts`
- `supabase/functions/website-domain-manager/index.ts`

**Implementation:**
```typescript
// Retry helper with exponential backoff
async function retryWithBackoff(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i) + Math.random() * 1000;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}
```

### 1.3 Graceful Degradation

**Scenarios:**
1. **Cloudflare unavailable** → Fall back to preview deployment only
2. **AI generation slow** → Show partial template with manual editing
3. **Compliance check fails** → Show "pending review" state, allow deployment with warning
4. **Domain DNS fails** → Provide manual DNS setup instructions

**Implementation in components:**
```typescript
// MaintenanceDashboard.tsx
export function MaintenanceDashboard({ projectId }: Props) {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [degradedMode, setDegradedMode] = useState(false);

  useEffect(() => {
    fetchHealthMetrics(projectId)
      .catch(error => {
        // Fall back to cached data or placeholder
        setDegradedMode(true);
        loadCachedHealth(projectId).then(setHealth);
      });
  }, [projectId]);

  if (!health) {
    return <HealthSkeleton degraded={degradedMode} />;
  }

  return <HealthMetrics data={health} degraded={degradedMode} />;
}
```

---

## 2. Rate Limiting Enforcement

### 2.1 Edge Function Rate Limiting

**Files to create:**
- `supabase/functions/rate-limiter/index.ts` — Shared rate limiter logic

**Configuration:**
```typescript
const RATE_LIMITS = {
  'website-operations-agent': {
    callsPerMinute: 10,
    burstSize: 20,
  },
  'cloudflare-deployer': {
    callsPerMinute: 5,
    burstSize: 10,
  },
  'website-domain-manager': {
    callsPerMinute: 15,
    burstSize: 30,
  },
} as const;
```

**Implementation:**
```typescript
// In each Edge Function
import { RateLimiter } from './rate-limiter';

const limiter = new RateLimiter('website-operations-agent');

Deno.serve(async (req) => {
  const userId = auth.user().id;
  
  if (!await limiter.allow(userId)) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded' }),
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  // Process request...
});
```

### 2.2 Client-Side Request Queuing

**Files to create:**
- `src/lib/request-queue.ts` — Request queue with priority support

**Usage:**
```typescript
const queue = new RequestQueue({
  concurrency: 3,
  timeout: 30000,
  retries: 3,
});

// Queue generation request with high priority
await queue.add(
  () => generateWebsite(projectId),
  { priority: 'high' }
);
```

### 2.3 Database Connection Pooling

**Files to update:**
- `supabase/functions/_shared/db.ts`

**Configuration:**
```typescript
const pool = new PgPool({
  host: 'host',
  port: 5432,
  database: 'postgres',
  user: 'user',
  password: 'pass',
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 20, // Max connections in pool
});
```

---

## 3. Security Hardening

### 3.1 RLS Policy Validation

**Files to create:**
- `supabase/functions/_shared/rls-validator.ts`

**Tests:**
- Verify all queries include `tenant_id` filter
- Validate RLS policies prevent cross-tenant access
- Test with service role vs. user role

**Script:**
```sql
-- Audit RLS policies
SELECT
  schemaname, tablename, policyname, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Verify all website_projects queries are tenant-filtered
EXPLAIN (ANALYZE)
SELECT * FROM website_projects
WHERE auth.uid() = (SELECT id FROM tenants WHERE id = tenant_id);
```

### 3.2 Input Sanitization

**Files to create:**
- `src/lib/sanitize.ts` — Input validation & sanitization
- `src/lib/validators.ts` — Type-safe validators

**Usage:**
```typescript
import { sanitizeWebsiteName, validateDomain } from '@/lib/sanitize';

const { name, error } = sanitizeWebsiteName(input);
if (error) throw new Error(error);

// Validates domain format, length, allowed characters
const { domain, error } = validateDomain(input);
```

### 3.3 Secrets Management

**Audit:**
- [ ] No secrets in .env (use Supabase Secrets)
- [ ] Service Role Key only in Edge Functions
- [ ] Stripe Secret Key in Edge Functions only
- [ ] API keys rotated monthly
- [ ] Audit log all secret access

**Checklist:**
```bash
# Verify no secrets in code
grep -r "sk_live_\|sk_test_\|whsec_" src/ supabase/functions/
grep -r "API_KEY\|SECRET_KEY" src/ supabase/functions/ --include="*.ts"

# Check environment variables
cat .env.local | grep -E "KEY|SECRET|TOKEN"
```

---

## 4. Monitoring & Alerting

### 4.1 Sentry Integration

**Files to update:**
- `src/lib/sentry.ts` — Already configured, expand error tracking

**Configuration:**
```typescript
Sentry.init({
  dsn: process.env.VITE_SENTRY_DSN,
  integrations: [
    new Sentry.Replay({ maskAllText: false, blockAllMedia: false }),
    new Sentry.CaptureConsole(),
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  environment: process.env.NODE_ENV,
});
```

**Error Tagging:**
```typescript
try {
  await generateWebsite(projectId);
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      'feature': 'website-generation',
      'phase': 'ai-generation',
      'project_id': projectId,
    },
    level: 'error',
  });
}
```

### 4.2 Error Rate Thresholds

**Files to create:**
- `src/lib/error-monitor.ts`

**Thresholds:**
```typescript
const ERROR_THRESHOLDS = {
  'website-generation': {
    errorRate: 0.05,    // 5% of requests fail
    window: 3600000,    // 1 hour window
    action: 'degrade',  // Switch to fallback UI
  },
  'cloudflare-deploy': {
    errorRate: 0.10,    // 10% of requests fail
    window: 600000,     // 10 minute window
    action: 'alert',    // Send alert to ops
  },
  'domain-propagation': {
    errorRate: 0.15,    // 15% of requests fail
    window: 1800000,    // 30 minute window
    action: 'retry',    // Retry with backoff
  },
};
```

### 4.3 Anomaly Detection

**Metrics to monitor:**
- Generation time (should be 5-15 seconds)
- Deployment time (should be <2 minutes)
- Domain propagation time (should be <5 minutes)
- Compliance score distribution (should be 50-95 range)
- SSL provisioning time (should be <15 minutes)

---

## 5. Performance Optimization

### 5.1 Caching Strategy

**Files to create:**
- `src/lib/cache.ts` — Intelligent caching layer

**Cache layers:**
```typescript
// 1. Browser cache (IndexedDB) — 7 days
const projectCache = new IDBCache('website-projects');

// 2. Edge cache (Cloudflare KV) — 1 hour
const complianceCache = new CloudflareKVCache('compliance');

// 3. Database cache (Redis equivalent) — 5 minutes
const healthMetricsCache = new SupabaseCache('health-metrics');
```

### 5.2 Query Optimization

**SQL optimizations:**
```sql
-- Add indexes for common queries
CREATE INDEX idx_website_projects_tenant ON website_projects(tenant_id, status);
CREATE INDEX idx_website_domains_project ON website_domains(project_id, is_active);
CREATE INDEX idx_deployment_logs_project ON deployment_logs(project_id, created_at DESC);
CREATE INDEX idx_compliance_reports_project ON website_compliance_reports(project_id, created_at DESC);

-- Analyze query performance
EXPLAIN ANALYZE
SELECT * FROM website_projects
WHERE tenant_id = 'abc123'
AND status IN ('draft', 'preview', 'live')
ORDER BY created_at DESC;
```

### 5.3 Batch Operations

**Files to update:**
- `src/features/website-operations/WebsiteOperationsDashboard.tsx`

**Usage:**
```typescript
// Batch load compliance reports for multiple projects
const reports = await batchLoadComplianceReports(projectIds, {
  batchSize: 20,
  parallelism: 3,
});

// Batch update deployment status
await batchUpdateDeploymentStatus(deploymentIds, 'live');
```

---

## 6. Documentation & Runbooks

### 6.1 Runbooks

**Files to create:**
- `docs/runbooks/website-generation-failure.md`
- `docs/runbooks/cloudflare-deployment-stuck.md`
- `docs/runbooks/domain-ssl-not-provisioning.md`
- `docs/runbooks/compliance-scan-timeout.md`
- `docs/runbooks/rate-limit-exceeded.md`

**Template:**
```markdown
# [Issue Title]

## Symptoms
- What users observe
- Error messages
- Metrics/alerts

## Root Causes
- Common causes
- Less common causes

## Diagnosis
- Step 1: Check X
- Step 2: Run query Y
- Step 3: View logs Z

## Resolution
- Step 1: Action
- Step 2: Verify
- Step 3: Document

## Prevention
- Configuration changes
- Monitoring improvements
```

### 6.2 Monitoring Dashboard

**Tools:** Grafana or Datadog  
**Metrics:**
- Generation success rate (target: 95%)
- Deployment success rate (target: 98%)
- Domain provisioning success rate (target: 90%)
- API response times (P95 < 2s)
- Error rates by type
- Rate limit violations
- Circuit breaker state

### 6.3 Operations Procedures

**Files to create:**
- `docs/ops/scaling-guide.md` — How to scale to 10k+ projects
- `docs/ops/incident-response.md` — IR procedures
- `docs/ops/maintenance-windows.md` — Planned maintenance process
- `docs/ops/backup-recovery.md` — Disaster recovery procedures

---

## Implementation Schedule

### Day 1: Error Handling & Recovery
- [ ] Circuit breaker implementation
- [ ] Retry logic with exponential backoff
- [ ] Graceful degradation strategies
- [ ] Testing & validation

### Day 2: Rate Limiting & Security
- [ ] Rate limiting enforcement
- [ ] Request queue implementation
- [ ] RLS policy validation
- [ ] Input sanitization library
- [ ] Secrets audit

### Day 3: Monitoring & Documentation
- [ ] Sentry integration enhancements
- [ ] Error threshold monitoring
- [ ] Performance optimization
- [ ] Runbooks & documentation
- [ ] Operations guides

---

## Testing Checklist

### Error Scenarios
- [ ] Simulate Cloudflare API timeout
- [ ] Simulate AI generation timeout
- [ ] Simulate database connection failure
- [ ] Simulate rate limit exceeded
- [ ] Simulate invalid input

### Performance Testing
- [ ] Load test: 100 concurrent generations
- [ ] Load test: 1000 domain lookups
- [ ] Load test: 10k compliance scans
- [ ] Stress test: Connection pool exhaustion
- [ ] Stress test: Memory leaks

### Security Testing
- [ ] RLS policy bypass attempts
- [ ] SQL injection attempts
- [ ] XSS payload validation
- [ ] CSRF token validation
- [ ] Secret exposure audit

---

## Success Criteria

✅ All error scenarios handled gracefully  
✅ Rate limiting enforced on all endpoints  
✅ 99.5% uptime target achieved  
✅ P95 response time < 2 seconds  
✅ Zero security vulnerabilities found  
✅ Incident response runbooks complete  
✅ Monitoring dashboards operational  
✅ Documentation complete & tested  

---

## Dependencies

- Phase 1-7 complete ✅
- Supabase project configured ✅
- Cloudflare integration working ✅
- Anthropic API credentials available ✅
- Sentry account configured ✅
- Monitoring tools available (optional)

---

## Rollout Strategy

1. **Feature flags:** Gradual rollout of hardening features
2. **Canary deployment:** 10% users → 50% → 100%
3. **Blue-green deployment:** Parallel old/new systems
4. **Monitoring:** Close watch for first 48 hours
5. **Rollback plan:** Quick revert if issues found

---

## Summary

**Phase 8 transforms** feature-complete code into production-hardened system with:
- Robust error handling & recovery
- Rate limiting & resource protection
- Security audit & hardening
- Comprehensive monitoring & alerting
- Performance optimization
- Operational documentation

**Target Status:** Production-ready, 99.5% uptime SLA

---

**Created:** 2026-07-17  
**Next Phase:** Phase 9 (Analytics & Optimization Recommendations)
