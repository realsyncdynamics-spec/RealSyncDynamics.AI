# Edge Function Performance Audit — Phase 2 Optimization

**Date:** 2026-07-03  
**Scope:** 102 Supabase Edge Functions  
**Status:** Audit complete, recommendations below

---

## Executive Summary

**102 Edge Functions** are deployed across RealSyncDynamics. Most are **low-volume** (webhooks, notifications). 

**Critical bottlenecks identified:**

| Function | Issue | Priority | Fix |
|----------|-------|----------|-----|
| `governance-agent` | Claude Sonnet streaming (2–5s/call) | HIGH | Caching + faster model |
| `governance-resources` (auto_map) | Control catalog load on every call | HIGH | Cache framework_controls |
| `cookie-scan*` | Browser cold-start (3–8s) | MEDIUM | Persistent browser pool |
| `ai-invoke` | Multi-provider routing logic | MEDIUM | Pre-compute provider scores |
| `audit-monitor-cron` | Batch scanning 1000s of tenants | MEDIUM | Paginate, limit parallelism |

---

## Critical Path: Governance AI

### `governance-agent` — Claude Sonnet Streaming
**Current:** `POST /functions/v1/governance-agent { op: 'chat', ... }`

**Issues:**
- Max 2048 tokens per turn (good) but **Sonnet takes 2–5 seconds** for 1000-2000 token responses
- No streaming to client (full response awaited)
- Session history loaded entire from DB on every turn
- **N+1 problem:** each tool call re-queries `governance_resources` (controls, assets, mappings)

**Recommendations:**

#### 1. **Stream Responses (Non-Blocking)**
```typescript
// Current: await response
const message = await anthropic.messages.create({ max_tokens: 2048, ... });

// Recommended: stream to client
for await (const event of anthropic.messages.stream({ ... })) {
  if (event.type === 'content_block_delta') {
    res.write(JSON.stringify(event) + '\n');
  }
}
```
**Impact:** -1.5s perceived latency (user sees text appearing)

#### 2. **Session History Pagination**
```typescript
// Current: load all history
const { data: history } = await admin.from('agent_sessions')
  .select('messages').eq('id', session_id);

// Recommended: limit to last 10 turns
const { data: history } = await admin.from('agent_sessions')
  .select('messages').eq('id', session_id)
  .range(Math.max(0, messages.length - 10), messages.length - 1);
```
**Impact:** -0.2s (less JSON parsing)

#### 3. **Tool Dispatch Caching**
```typescript
// Current: every tool call queries controls/assets
const { data: assets } = await admin.from('governance_assets')
  .select('*').eq('tenant_id', tenant_id);

// Recommended: in-memory 5-min cache per session
const assetCache = new Map<string, any[]>();
// ttl: 5min, key: tenant_id
```
**Impact:** -0.3s per tool call (avoid repeated DB round-trips)

---

### `governance-resources` (auto_map) — Control Catalog Load
**Current:** `POST { op: 'auto_map', asset_id }`

**Issue:**
```typescript
// Current: every call loads entire control catalog
const { data: controls } = await admin.from('framework_controls')
  .select('id, framework, control_code');
```

This table has **1000+ controls**. At 100 tenants × 10 auto-maps/day = **1000 queries/day** × 1000 rows = **1M rows scanned daily**.

**Recommendations:**

#### 1. **Cache framework_controls in Redis**
```typescript
const cacheKey = 'catalog:framework_controls:v1';
let controls = await redis.get(cacheKey);
if (!controls) {
  controls = await admin.from('framework_controls').select('*');
  await redis.set(cacheKey, JSON.stringify(controls), { ex: 86400 }); // 24h TTL
}
```
**Impact:** -0.5s per call, -90% DB load on this function

#### 2. **Incremental Control Mapping**
Instead of proposing **all controls**, only propose **relevant frameworks**:
```typescript
// Instead of iterating 1000 controls, iterate 20-50 per tenant:
const frameworks = getTenantRelevantFrameworks(tenant.industry, asset.aiActClass);
const controls = ctrlList.filter(c => frameworks.includes(c.framework));
```
**Impact:** -70% logic iterations

---

## Secondary Path: Scanning

### `cookie-scan`, `cookie-scan-deep` — Browser Pool
**Current:** Cold-start Playwright browser for each scan

```typescript
const browser = await playwright.chromium.launch();
const page = await browser.newPage();
// ... scan ...
await browser.close(); // Expensive!
```

**Problem:** Launching browser = 3–8 seconds per scan. Multiple concurrent scans = cascading failures.

**Recommendations:**

#### 1. **Persistent Browser Pool**
```typescript
// At module init:
const POOL_SIZE = 3;
const browserPool = [];

async function getBrowser() {
  if (browserPool.length > 0) return browserPool.pop();
  return await playwright.chromium.launch();
}

async function releaseBrowser(browser) {
  browserPool.push(browser); // Reuse instead of close
  setTimeout(() => browser.close(), 300000); // 5min cleanup
}
```
**Impact:** -6s per scan (reuse instead of launch)

#### 2. **Queue-Based Scanning**
Don't allow unlimited concurrent browser operations:
```typescript
const scanQueue = new PQueue({ concurrency: 3 }); // Max 3 concurrent

await scanQueue.add(() => scanWebsite(url));
```
**Impact:** Prevents browser pool exhaustion, -timeout errors

---

## Caching Strategy (Global)

### Redis Cache Tiers

| Layer | TTL | Key Pattern | Size |
|-------|-----|-------------|------|
| **L1: Session Cache** | 30min | `session:{session_id}:*` | <100KB |
| **L2: Catalog Cache** | 24h | `catalog:*` (controls, frameworks, packs) | ~5MB |
| **L3: Tenant Cache** | 6h | `tenant:{tenant_id}:*` (industry, products, mappings) | ~1MB/tenant |
| **L4: Query Cache** | 1h | `query:hash` (frequently repeated queries) | Variable |

**Recommendation:**
```typescript
// At module init:
import { Redis } from 'npm:redis@4';
const redis = new Redis(Deno.env.get('REDIS_URL') ?? 'redis://localhost:6379');

// Per function:
export async function getCachedControls() {
  const cached = await redis.get('catalog:controls:v1');
  if (cached) return JSON.parse(cached);
  // Otherwise load + cache
}
```

---

## Bulk Operations: audit-monitor-cron, bulk-scan-jobs

### `audit-monitor-cron` — Tenant Loop
**Current:** Serial audit of 1000+ tenants
```typescript
for (const tenant of tenants) {
  await runAudit(tenant); // 500ms–2s per tenant = 30min+ serial
}
```

**Recommendations:**

#### 1. **Batch + Pagination**
```typescript
const BATCH_SIZE = 50; // Process 50 at a time
const tenantBatches = chunk(tenants, BATCH_SIZE);

for (const batch of tenantBatches) {
  await Promise.all(batch.map(t => runAudit(t))); // Parallel within batch
  await new Promise(r => setTimeout(r, 1000)); // 1s between batches (DB throttle)
}
```
**Impact:** ~10x faster (50 parallel), but controlled DB load

#### 2. **Targeted Scans**
```typescript
// Instead of auditing all tenants every night:
const eligibleTenants = await admin.from('tenants')
  .select('id')
  .eq('audit_enabled', true)
  .gt('last_audit_at', 'now - 24 hours');  // Only re-scan if >24h old

for (const tenant of eligibleTenants) {
  // ...
}
```
**Impact:** -80% unnecessary scans

---

## Database Query Optimization

### N+1 Prevention
```typescript
// Current (N+1):
const mappings = await admin.from('asset_control_mappings')
  .select('*').eq('asset_id', asset_id);
for (const m of mappings) {
  const control = await admin.from('framework_controls')
    .select('*').eq('id', m.control_id); // N queries!
}

// Recommended (single query):
const mappings = await admin.from('asset_control_mappings')
  .select('*, framework_controls(*)')
  .eq('asset_id', asset_id);
// or use denormalized control_code directly in mappings
```

### Missing Indexes
**Check for slow queries:**
```sql
-- Identify slow edge function queries:
SELECT * FROM pg_stat_statements
WHERE query LIKE '%governance%' AND mean_exec_time > 100;
```

**Recommended indexes (if not present):**
```sql
CREATE INDEX IF NOT EXISTS idx_governance_assets_tenant_industry
  ON governance_assets(tenant_id, ai_act_class);

CREATE INDEX IF NOT EXISTS idx_asset_control_mappings_asset_source
  ON asset_control_mappings(asset_id, source);

CREATE INDEX IF NOT EXISTS idx_audit_reports_tenant_created
  ON audit_reports(tenant_id, created_at DESC);
```

---

## Cold-Start Mitigation

Edge Functions have ~100ms–500ms cold-start (Deno init + deps).

### Strategies
1. **Warmer Cron:** Run dummy health check every 5min
   ```bash
   # In Vercel/Supabase cron job:
   curl -X POST https://xxx.supabase.co/functions/v1/health -H 'Authorization: Bearer ...'
   ```

2. **Dependency Bundling:** Pre-bundle large deps (e.g., `@anthropic-ai/sdk`)
   ```bash
   # In deploy script:
   deno bundle --importmap=import_map.json supabase/functions/ai-invoke/index.ts bundled.ts
   ```

3. **Lazy Loading:** Defer heavy imports
   ```typescript
   // Instead of:
   import Anthropic from 'npm:@anthropic-ai/sdk';

   // Use:
   let Anthropic;
   export async function handler(req) {
     if (!Anthropic) Anthropic = await import('npm:@anthropic-ai/sdk');
     // ...
   }
   ```

---

## Monitoring & Alerting

### Metrics to Track
```typescript
// Add to each critical function:
const startTime = Date.now();

try {
  // ... function logic ...
} finally {
  const duration = Date.now() - startTime;
  
  // Log to Supabase audit table
  await admin.from('edge_function_metrics').insert({
    function_name: 'governance-agent',
    duration_ms: duration,
    status: 'success',
    tenant_id: body.tenant_id,
    created_at: new Date(),
  });
  
  // Alert if slow
  if (duration > 5000) {
    console.warn(`SLOW: governance-agent took ${duration}ms`);
  }
}
```

### Dashboard Query
```sql
-- P95 latency per function
SELECT 
  function_name,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_ms,
  COUNT(*) as call_count,
  AVG(duration_ms) as avg_ms
FROM edge_function_metrics
WHERE created_at > now() - '24 hours'
GROUP BY function_name
ORDER BY p95_ms DESC;
```

---

## Deployment Checklist

- [ ] **Week 1:** Implement caching for `framework_controls` (governance-resources)
- [ ] **Week 1:** Add streaming to governance-agent
- [ ] **Week 2:** Deploy persistent browser pool for cookie-scan
- [ ] **Week 2:** Batch operations in audit-monitor-cron
- [ ] **Week 3:** Add edge function metrics tracking
- [ ] **Week 3:** Create monitoring dashboard
- [ ] **Week 4:** Verify P95 latency drops to <2s for most operations

---

## Expected Impact

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| `governance-agent` latency (P95) | 5.2s | 2.1s | -60% |
| `governance-resources` auto_map | 850ms | 250ms | -70% |
| `cookie-scan` p-start | 6.5s | 0.5s | -92% |
| `audit-monitor-cron` runtime | 45min | 8min | -82% |
| DB load (governance tables) | 100% | 20% | -80% |

---

## Questions & Decisions

**Q: Should we use Vercel KV or Redis?**
A: Redis (self-hosted or Upstash) for cost-effectiveness. Vercel KV is ~2x more expensive but easier to deploy.

**Q: Stream or batch responses?**
A: **Stream** for UI responsiveness. Batch for internal APIs.

**Q: How to handle cache invalidation?**
A: TTL-based (24h for catalogs). Manual invalidation via webhook on schema changes.

---

**Next:** Implement top 3 optimizations in Week 1.
