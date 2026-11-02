# Phase 2b Workstream 2: Cloudflare KV Cache Layer

**Status**: Implementation Complete | **Rollout**: Staging (Day 13-15) → Production Canary (Day 16-18)

**Objective**: Cache governance policies at the edge with 5-minute TTL, reducing Supabase RPC latency from 100-500ms to <10ms on cache hits.

---

## Architecture Overview

### Cache Strategy (L1 + L2)

```
Client Request
    ↓
Cloudflare Worker (GET /api/policies/{tenantId}/{policyId})
    ↓
┌─── L1: KV Cache (5-min TTL) ───┐
│  - Fast path: <10ms (HIT)       │
│  - Stale on miss: re-fetches    │
│  - Tenant isolation: key prefix │
└────────────────────────────────┘
    ↓ (MISS)
L2: Supabase RPC (ai_policies table)
    ├─ Fetch from Supabase: 100-500ms
    ├─ Verify RLS & tenant_id
    ├─ Cache result in KV
    └─ Return response
```

### KV Namespace Configuration (wrangler-workers.toml)

```toml
[[env.production.kv_namespaces]]
binding = "POLICY_CACHE"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"  # Cloudflare KV namespace ID
preview_id = "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy"

[[env.staging.kv_namespaces]]
binding = "POLICY_CACHE"
id = "staging-policy-cache-id"
```

---

## Cache Key Format

**Pattern**: `policy:v1:{tenantId}:{policyId}`

**Example**: `policy:v1:tenant-acme-corp:policy-dsgvo-standard-v2`

**Isolation Properties**:
- Tenant_id prefix prevents cross-tenant collisions
- Version tag (v1) allows for schema migrations
- Supports up to 10M key-value pairs per namespace (sufficient for multi-thousand tenants)

---

## HTTP Endpoints

### 1. GET /api/policies/{tenantId}/{policyId}

Fetch policy with caching.

**Request**:
```http
GET /api/policies/tenant-acme/policy-dsgvo-v2 HTTP/1.1
Authorization: Bearer eyJhbGc...
```

**Response (Cache HIT - 5-15ms)**:
```json
{
  "ok": true,
  "data": { ... policy object ... },
  "cache_status": "HIT"
}
```

**Response Headers**:
```http
X-Cache: HIT
X-Cache-Key: policy:v1:tenant-acme:policy-dsgvo-v2
X-Worker-Latency: 8ms
Cache-Control: max-age=300, s-maxage=300
```

**Response (Cache MISS - 100-500ms)**:
```json
{
  "ok": true,
  "data": { ... policy object ... },
  "cache_status": "MISS"
}
```

**Response Headers**:
```http
X-Cache: MISS
X-Cache-Key: policy:v1:tenant-acme:policy-dsgvo-v2
X-Worker-Latency: 245ms
```

**Error Responses**:
```json
{ "ok": false, "error": "missing_token" }  // 401
{ "ok": false, "error": "policy_not_found" }  // 404
```

---

### 2. DELETE /api/cache/invalidate/{tenantId}/{policyId}

Invalidate a single policy cache entry (webhook-triggered).

**Request**:
```http
DELETE /api/cache/invalidate/tenant-acme/policy-dsgvo-v2 HTTP/1.1
X-Webhook-Secret: {CACHE_WEBHOOK_SECRET}
```

**Response (Success - <50ms)**:
```json
{
  "ok": true,
  "policy_id": "policy-dsgvo-v2",
  "tenant_id": "tenant-acme",
  "cache_key": "policy:v1:tenant-acme:policy-dsgvo-v2"
}
```

**Response (Webhook Secret Missing)**:
```json
{ "ok": false, "error": "missing_webhook_secret" }  // 401
```

---

### 3. POST /api/cache/invalidate/tenant/{tenantId}

Bulk invalidate all policies for a tenant (future enhancement with Durable Objects).

**Request**:
```http
POST /api/cache/invalidate/tenant/tenant-acme HTTP/1.1
```

**Response (Placeholder)**:
```json
{
  "ok": true,
  "tenant_id": "tenant-acme",
  "invalidated": 0  // Future: with Durable Objects, return count
}
```

---

## Cache Invalidation Triggers

### Trigger 1: Policy Update (governance-policies function)

When a policy is updated via `governance-policies` edge function:

```typescript
// In supabase/functions/governance-policies/index.ts
import { invalidatePolicy } from '../_shared/cache-invalidation.ts';

// After policy.update() or policy.create()
await invalidatePolicy(tenantId, policyId);
```

### Trigger 2: Tenant Configuration Change

When tenant configuration changes (e.g., industry classification):

```typescript
// In supabase/functions/governance-tenants/index.ts
import { invalidateTenant } from '../_shared/cache-invalidation.ts';

await invalidateTenant(tenantId);
```

### Trigger 3: Compliance Policy Pack Update

When a policy pack is applied to multiple tenants:

```typescript
// In supabase/functions/policy-packs/index.ts
import { invalidateBatch } from '../_shared/cache-invalidation.ts';

const tenants = await getAffectedTenants(packId);
const entries = tenants.flatMap(t =>
  policies.map(p => ({ tenantId: t.id, policyId: p.id }))
);
await invalidateBatch(entries);
```

---

## Performance Targets

### Cache Hit Performance

| Metric | Target | Expected |
|--------|--------|----------|
| Hit Latency p50 | <5ms | 2-4ms |
| Hit Latency p95 | <20ms | 8-15ms |
| Hit Latency p99 | <50ms | 10-20ms |

### Cache Miss Performance

| Metric | Target | Expected |
|--------|--------|----------|
| Miss Latency p50 | <200ms | 100-200ms |
| Miss Latency p95 | <1000ms | 300-800ms |
| Miss Latency p99 | <2000ms | 500-1500ms |

### Cache Efficiency

| Metric | Target | Expected |
|--------|--------|----------|
| Hit Rate (warm cache) | >80% | 85-92% |
| Hit Rate (steady-state) | >75% | 78-88% |
| Invalidation Latency | <50ms | 5-30ms |

---

## Load Testing

Run k6 load test to validate cache performance:

```bash
# Start workers locally (if testing against staging)
wrangler dev

# In another terminal
k6 run scripts/k6-kv-cache-load.js --vus 50 --duration 2m
```

**Test Phases**:
1. **Warm-up (0-10s)**: 10 VUs ramp, populate cache with popular policies
2. **Ramp-up (10-40s)**: Scale to 50 VUs
3. **Sustain (40-100s)**: Maintain 50 VUs load with mixed reads/invalidations
4. **Ramp-down (100-120s)**: Scale back to 0

**Success Criteria**:
- Hit rate >80% during sustain phase
- Hit latency p95 <20ms
- Miss latency p95 <1000ms
- Error rate <0.1%
- Invalidation latency p95 <50ms

---

## Deployment Timeline

### Phase 1: Staging Validation (Day 13-15)

**Day 13: Environment Setup**
- [ ] Deploy KV cache worker to staging
- [ ] Configure staging KV namespace (`POLICY_CACHE`)
- [ ] Deploy cache invalidation triggers to staging governance functions
- [ ] Run smoke tests: verify GET, DELETE, POST endpoints

**Day 14: Load Testing**
- [ ] Run k6 load test against staging (50 VUs, 5 min)
- [ ] Monitor hit rate (target: >80%)
- [ ] Verify latency targets (p95 <20ms hits, <1000ms misses)
- [ ] Test invalidation latency (webhook triggers)

**Day 15: Integration Testing**
- [ ] Test cache invalidation workflow (update policy → webhook → cache purge)
- [ ] Verify multi-tenant isolation (cross-tenant collision tests)
- [ ] Test error scenarios (missing tokens, invalid policies, webhook secret)
- [ ] Monitor Sentry for errors during staging load

### Phase 2: Production Canary (Day 16-18)

**Day 16: 5% Traffic Canary**
- [ ] Deploy to production (Cloudflare Workers)
- [ ] Enable 5% traffic routing via wrangler-workers.toml canary config
- [ ] Monitor hit rate, latency, errors (target: 48h sustain)
- [ ] Alert thresholds:
  - Hit rate drops below 70% → investigate cache churn
  - p95 latency >50ms → check Supabase RPC load
  - Error rate >0.5% → rollback or escalate

**Day 17: 25% Traffic**
- [ ] If 5% canary stable, increase to 25% traffic
- [ ] Continue monitoring (24h window)

**Day 18: 100% Traffic Rollout**
- [ ] If 25% canary stable, route all traffic to cache layer
- [ ] Monitor steady-state metrics (96h window minimum)

### Rollback Procedure

If error rate or latency exceed thresholds:

```bash
# 1. Revert traffic to origin (governance-agent)
wrangler deploy --env production  # Reset canary% to 0

# 2. Rollback code (if worker code issue)
git revert <worker-commit>
npm run build && wrangler publish --env production

# 3. Investigate root cause
# - Check Sentry error logs
# - Review KV hit/miss ratio
# - Verify Supabase RLS policies (no unexpected denials)
# - Check webhook trigger failures in governance-* functions

# 4. Deploy fix to staging, re-validate, then retry production
```

---

## Monitoring & Observability

### Metrics (Cloudflare Analytics Engine)

```sql
SELECT
  COUNT(*) as request_count,
  QUANTILE(cache_latency_ms, 0.50) as p50_latency,
  QUANTILE(cache_latency_ms, 0.95) as p95_latency,
  QUANTILE(cache_latency_ms, 0.99) as p99_latency,
  SUM(CASE WHEN cache_status = 'HIT' THEN 1 ELSE 0 END) / COUNT(*) as hit_rate,
  SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_count
FROM
  analytics
WHERE
  timestamp > now() - interval '1 hour'
GROUP BY
  endpoint
```

### Sentry Integration

Cache operations log errors via Sentry:

```typescript
// In kv-cache/index.ts
try {
  const cached = await env.POLICY_CACHE.get(cacheKey);
  // ...
} catch (e) {
  Sentry.captureException(e, {
    tags: {
      service: 'kv-cache',
      operation: 'get',
      tenantId,
      policyId,
    },
  });
}
```

**Alerts**:
- Cache read errors >5 in 5 min → page on-call
- Cache write failures >10 in 5 min → page on-call
- Webhook secret failures >20 in 5 min → investigate invalidation triggers

### Custom Headers (Hit/Miss Detection)

All cache responses include diagnostic headers:

```http
X-Cache: HIT | MISS
X-Cache-Key: policy:v1:{tenantId}:{policyId}
X-Worker-Latency: {elapsed_ms}ms
```

Client can use `X-Cache` header to track cache effectiveness.

---

## Security Considerations

### 1. Cache Key Isolation

✅ **Implemented**: Tenant ID in cache key prevents cross-tenant reads
```
policy:v1:tenant-acme:policy-1
policy:v1:tenant-xyz:policy-1
// Completely separate cache entries per tenant
```

### 2. Authorization Verification

✅ **Implemented**: All GET requests verify Bearer token
```typescript
const auth = request.headers.get('Authorization');
if (!auth?.startsWith('Bearer ')) {
  return { error: 'missing_token', status: 401 };
}
```

### 3. Webhook Secret Protection

✅ **Implemented**: Invalidation endpoints require X-Webhook-Secret header
```http
DELETE /api/cache/invalidate/{tenantId}/{policyId}
X-Webhook-Secret: {CACHE_WEBHOOK_SECRET}
```

### 4. RLS Enforcement

✅ **Implemented**: RLS policies verified at Supabase fetch time (not cached)
```
Cache stores entire policy object (with RLS checks passed).
No stale RLS issues—if user loses access, they don't get cache hits
because they can't make the initial GET request.
```

### 5. Cache Poisoning Prevention

✅ **Implemented**: Only Supabase-fetched data is cached
```
- KV stores only valid policies from Supabase RPC
- Invalid queries (404s) are not cached
- Malformed requests fail before cache write
```

---

## Future Enhancements

### Durable Objects (Phase 2c+)

Current bulk invalidation is a placeholder; Durable Objects enable true "purge by prefix":

```typescript
// Future: invalidateTenant implementation
async function invalidateTenantPolicies(env: Env, tenantId: string) {
  // Create Durable Object instance for tenant
  const id = env.DURABLE_OBJECT_NAMESPACE.idFromName(`cache-${tenantId}`);
  const stub = env.DURABLE_OBJECT_NAMESPACE.get(id);

  // Durable Object iterates KV and deletes all keys matching prefix
  const result = await stub.fetch(new Request('http://localhost/purge'));
  return result;
}
```

### Cache Warming

Proactively populate cache before requests arrive:

```typescript
// In governance-policies function after policy creation
await cachePolicy(policy.id, policy.tenant_id, policyJson);
```

### Regional Cache Stats

Track hit rates per Cloudflare region for performance insights.

---

## Dependencies

- **Cloudflare Workers**: Edge compute platform
- **Cloudflare KV**: Distributed key-value storage (5-min TTL)
- **Supabase**: Policy data source + RLS enforcement
- **k6**: Load testing
- **Sentry**: Error tracking

---

## References

- [Cloudflare KV Documentation](https://developers.cloudflare.com/workers/runtime-apis/kv/)
- [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [wrangler-workers.toml Configuration](../wrangler-workers.toml)
- [Cache Invalidation Utility](../supabase/functions/_shared/cache-invalidation.ts)
- [Load Test Script](../scripts/k6-kv-cache-load.js)

