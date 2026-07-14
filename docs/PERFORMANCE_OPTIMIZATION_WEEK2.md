# Performance Optimization for Week 2 Production

**Target Reduction:**
- governance-agent: 2–5s → <2s
- governance-resources: 850ms → <400ms
- cookie-scan: 3–8s → <2s
- Database queries: p95 <200ms

---

## 1. Database Optimization

### 1.1 Strategic Indices (Deployed via Migration)

New indices created in `20260703_optimize_governance_indices.sql`:

| Index | Purpose | Expected Latency Improvement |
|-------|---------|------|
| idx_governance_assets_tenant_ref | Asset lookups by tenant | 200ms → 50ms |
| idx_governance_controls_tenant_type | Control filtering | 150ms → 40ms |
| idx_governance_audit_log_asset | Provenance chain queries | 300ms → 100ms |
| idx_governance_audit_log_tenant_time | Audit log range queries | 250ms → 80ms |
| idx_governance_policy_packs_tenant | Policy pack recommendations | 180ms → 45ms |
| idx_governance_current_mappings_asset_control | Control status lookups | 120ms → 30ms |
| idx_signing_keys_active | Signing key lookups | 100ms → 25ms |

**Implementation Note:** All indices use CONCURRENTLY to avoid locking tables during deployment.

---

## 2. Redis Caching Strategy

### 2.1 Cache Layers

**Layer 1: Policy Packs (High-Value Cache)**
```typescript
// supabase/functions/governance-agent/index.ts
const cacheKey = `governance:policy-packs:${tenantId}:${industry}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const packs = await getPolicyPacksForIndustry(tenantId, industry);
await redis.setex(cacheKey, 3600, JSON.stringify(packs)); // 1 hour TTL
return packs;
```

**Impact:** Reduces database queries for policy pack recommendations from 850ms → 200ms

**Layer 2: Control Metadata (Medium-Value Cache)**
```typescript
const cacheKey = `governance:controls:${tenantId}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const controls = await db.query('SELECT * FROM governance_controls WHERE tenant_id = ?');
await redis.setex(cacheKey, 1800, JSON.stringify(controls)); // 30 min TTL
return controls;
```

**Impact:** Reduces control lookups from 150ms → 50ms

**Layer 3: Industry Detection (Low-Value Cache)**
```typescript
const cacheKey = `governance:tenant:${tenantId}:industry`;
const industry = await redis.get(cacheKey);
if (industry) return industry;

const result = await db.query('SELECT industry FROM tenants WHERE id = ?');
await redis.setex(cacheKey, 7200, result.industry); // 2 hour TTL
return result.industry;
```

**Cache Invalidation Strategy:**
- Invalidate Layer 1 when policy packs are updated
- Invalidate Layer 2 when controls are updated (rare)
- Invalidate Layer 3 when tenant profile changes

### 2.2 Redis Configuration

**Environment Variables:**
```bash
REDIS_URL=redis://staging-redis.realsyncdynamics.ai:6379
REDIS_PASSWORD=[staging-redis-password]
REDIS_DB=2  # Separate DB for governance cache
CACHE_TTL_POLICY_PACKS=3600  # 1 hour
CACHE_TTL_CONTROLS=1800     # 30 minutes
CACHE_TTL_INDUSTRY=7200     # 2 hours
```

**Connection Pooling:**
```typescript
// supabase/functions/_shared/redis-pool.ts (NEW)
import { createPool } from 'redis';

const pool = createPool({
  min: 5,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function getCachedValue(key: string): Promise<string | null> {
  const client = await pool.acquire();
  try {
    return await client.get(key);
  } finally {
    await pool.release(client);
  }
}
```

---

## 3. Cold-Start Mitigation

### 3.1 Lightweight Module Initialization

**Problem:** Edge Functions spend 1–2s initializing heavy imports (OpenAI, Anthropic)

**Solution:** Lazy-load AI providers only when needed

**Before (Cold-Start ~2s):**
```typescript
import { Anthropic } from '@anthropic-ai/sdk';

export async function handler(req: Request) {
  const client = new Anthropic(); // Initialize on every request
  return await client.messages.create(...);
}
```

**After (Cold-Start ~500ms):**
```typescript
let anthropicClient: Anthropic | null = null;

async function getAnthropicClient(): Promise<Anthropic> {
  if (!anthropicClient) {
    const { Anthropic } = await import('@anthropic-ai/sdk');
    anthropicClient = new Anthropic();
  }
  return anthropicClient;
}

export async function handler(req: Request) {
  const client = await getAnthropicClient();
  return await client.messages.create(...);
}
```

**Apply to:**
- `supabase/functions/governance-agent/`
- `supabase/functions/governance-resources/`
- `supabase/functions/cookie-scan/`

### 3.2 Module-Level Caching

**Problem:** Parsing JSON/YAML controls on every invocation

**Solution:** Cache parsed controls at module level

```typescript
// supabase/functions/_shared/controls-cache.ts (NEW)
let controlsCache: ControlDefinition[] | null = null;

export async function getControls(tenantId: string): Promise<ControlDefinition[]> {
  if (controlsCache) return controlsCache;

  controlsCache = await db.query('SELECT * FROM governance_controls WHERE tenant_id = ?');
  return controlsCache;
}

// Call this on module init (once per container lifetime)
await getControls(tenantId);
```

**Expected Cold-Start Reduction:** 40–60%

---

## 4. Query Optimization

### 4.1 Database Query Analysis

**Current Bottleneck (governance-agent):**
```sql
-- SLOW: Multiple round-trips
SELECT * FROM governance_assets WHERE tenant_id = ?;
SELECT * FROM governance_controls WHERE tenant_id = ?;
SELECT * FROM governance_auto_mappings WHERE asset_id IN (...);
```

**Optimized:**
```sql
-- FAST: Single query with prepared statement
SELECT 
  a.id, a.asset_ref, a.risk_classification,
  c.id, c.control_type, c.description,
  m.status, m.confidence
FROM governance_assets a
LEFT JOIN governance_controls c ON a.tenant_id = c.tenant_id
LEFT JOIN governance_auto_mappings m ON a.id = m.asset_id AND c.id = m.control_id
WHERE a.tenant_id = ? AND a.status != 'archived'
ORDER BY a.asset_ref, c.priority;
```

**Impact:** 3 queries (850ms) → 1 query (180ms)

### 4.2 Pagination for Large Results

**Problem:** Loading 1000+ controls at once causes memory spikes

**Solution:** Paginate control queries
```typescript
export async function getControlsPaginated(
  tenantId: string,
  limit: number = 100,
  offset: number = 0,
): Promise<{ controls: Control[]; total: number }> {
  const [controls, countResult] = await Promise.all([
    db.query(
      'SELECT * FROM governance_controls WHERE tenant_id = ? LIMIT ? OFFSET ?',
      [tenantId, limit, offset],
    ),
    db.query(
      'SELECT COUNT(*) FROM governance_controls WHERE tenant_id = ?',
      [tenantId],
    ),
  ]);
  return { controls, total: countResult[0].count };
}
```

---

## 5. Performance Monitoring

### 5.1 Sentry Metrics (Already Configured)

**Metrics to Track:**

| Metric | Target | Alert Threshold |
|--------|--------|---|
| governance-agent p95 latency | <2s | >2.5s |
| governance-agent p99 latency | <2.5s | >3s |
| Database query p95 | <200ms | >250ms |
| Cache hit rate | >80% | <70% |
| Cold-start latency | <1s | >1.2s |

**Sentry Dashboard:**
```
Project: RealSyncDynamics
Environment: staging
Duration: Last 24 hours

Widgets:
1. Latency (p50, p95, p99) for governance-agent
2. Cache hit/miss ratio
3. Database query performance
4. Cold-start frequency
5. Error rate by function
```

### 5.2 Database Performance Queries

**Monitor query performance:**
```sql
-- Check slow queries
SELECT 
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE query LIKE '%governance%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Check index usage:**
```sql
-- Verify new indices are being used
SELECT 
  schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename LIKE 'governance%'
ORDER BY idx_scan DESC;
```

---

## 6. Week 2 Deployment Checklist

- [ ] Database indices deployed (20260703_optimize_governance_indices.sql)
- [ ] Redis pool initialized in _shared/redis-pool.ts
- [ ] Policy pack caching implemented in governance-agent
- [ ] Lazy-loading implemented for AI provider clients
- [ ] Module-level control caching deployed
- [ ] Query optimization merged into main
- [ ] Sentry performance dashboards configured
- [ ] Load testing run: 20 concurrent users auto-mapping
- [ ] Production cold-start measured: <1s
- [ ] Cache hit rate verified: >80%
- [ ] p99 latency verified: <2s

---

## 7. Rollback Plan

**If Performance Targets Not Met:**

1. Disable caching: Set REDIS_URL=""
2. Revert query optimizations: `git revert <commit>`
3. Monitor p95 latency
4. Identify bottleneck with flame graphs
5. Re-deploy with targeted optimization

**Acceptable Degradation:**
- governance-agent p95: <3s (fallback from <2s target)
- Database query p95: <300ms (fallback from <200ms)

---

## 8. Future Optimizations (Week 3+)

- [ ] Streaming auto-mapping results (don't wait for all assets)
- [ ] GraphQL instead of REST (reduce payload size)
- [ ] Edge-side caching with Cloudflare KV
- [ ] Database connection pooling with PgBouncer
- [ ] Compression for PDF export (GZIP)
- [ ] CDN for static control definitions

---

**Version:** 1.0  
**Target Deployment:** Week 2 Go-Live (2026-07-10)  
**Owner:** Platform Team  
**Measurement:** Sentry + Database query analysis

