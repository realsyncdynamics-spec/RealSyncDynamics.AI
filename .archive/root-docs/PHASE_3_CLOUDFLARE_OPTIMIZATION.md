# Phase 3: Cloudflare Optimization — Implementation Guide

**Status:** In Progress  
**Date:** 2026-07-23  
**Goal:** Cache optimization + KV Governance Policy cache + R2 Evidence Vault prep

---

## 1. Cache Policy Configuration

### ✅ Implemented: `public/_headers`

**Cache Rules by Content Type:**

```
/ (HTML)           max-age=0, s-maxage=3600  (CDN cached 1h, browser fresh)
/assets/*          max-age=31536000          (1-year immutable assets)
/*.js/*.css        max-age=31536000          (Immutable bundles)
/api/*             max-age=0, no-cache       (No caching for APIs)
/governance/*      max-age=300, s-maxage=3600 (5 min browser, 1h CDN)
/audit/*           max-age=60, s-maxage=600  (1 min browser, 10 min CDN)
```

**Benefits:**
- ✅ Static assets cached for 1 year (no revalidation)
- ✅ HTML always fresh (but CDN cached for 1h)
- ✅ API endpoints never cached (fresh data)
- ✅ Governance/Audit pages cached for performance

---

## 2. KV Namespace: Governance Policy Cache

### Configuration

**Namespace:** `governance_policy_cache`  
**Purpose:** Cache policy evaluation results to reduce database queries

### Setup (via Wrangler):

```bash
# Create KV namespace
wrangler kv:namespace create "governance_policy_cache" --preview

# Add to wrangler.toml:
[[kv_namespaces]]
binding = "GOVERNANCE_CACHE"
id = "YOUR_NAMESPACE_ID"
preview_id = "YOUR_PREVIEW_ID"
```

### Wrangler.toml Entry:

```toml
[env.production]
kv_namespaces = [
  { binding = "GOVERNANCE_CACHE", id = "YOUR_KV_ID" }
]
```

### Policy Cache Strategy

**Cache Key Pattern:**
```
governance:policy:{tenant_id}:{policy_id}:{version}
```

**TTL:** 1 hour (3600 seconds)

**Value Schema:**
```json
{
  "policy_id": "uuid",
  "tenant_id": "uuid",
  "version": 1,
  "controls": [...],
  "cached_at": "2026-07-23T16:00:00Z",
  "expires_at": "2026-07-23T17:00:00Z"
}
```

**Usage in Edge Function:**

```typescript
// Check KV cache first
const cached = await GOVERNANCE_CACHE.get(
  `governance:policy:${tenantId}:${policyId}:1`
);
if (cached) return JSON.parse(cached);

// Fall back to database
const policy = await db.getPolicyEvaluation(...);
await GOVERNANCE_CACHE.put(
  `governance:policy:${tenantId}:${policyId}:1`,
  JSON.stringify(policy),
  { expirationTtl: 3600 }
);

return policy;
```

---

## 3. Cache Invalidation Webhook

### Endpoint: `POST /api/cache/invalidate`

**Trigger:** When policies are created/updated/deleted

**Webhook Payload:**

```json
{
  "event": "policy.updated",
  "tenant_id": "uuid",
  "policy_id": "uuid",
  "policy_version": 2,
  "affected_keys": [
    "governance:policy:*:abc123:*"
  ],
  "timestamp": "2026-07-23T16:00:00Z"
}
```

**Implementation (Edge Function):**

```typescript
// supabase/functions/cache-invalidate/index.ts

export default async (req: Request, env: any) => {
  const { event, tenant_id, policy_id, affected_keys } = await req.json();

  if (event === "policy.updated") {
    // Invalidate all matching keys
    for (const key of affected_keys) {
      const keys = await GOVERNANCE_CACHE.list({ prefix: key });
      for (const { name } of keys.keys) {
        await GOVERNANCE_CACHE.delete(name);
      }
    }
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
};
```

**Integration Points:**

1. **Policy Service:** POST to cache invalidation endpoint on update
2. **Admin Panel:** Invalidate cache button for manual purge
3. **Tenant Settings:** Option to clear tenant cache

---

## 4. R2 Evidence Vault Preparation

### R2 Bucket: `evidence-vault`

**Purpose:** Long-term evidence storage (compliance archive)

### Setup:

```bash
# Create R2 bucket (via Cloudflare Dashboard)
# Bucket Name: realsyncdynamics-evidence-vault
# Region: EMEA (EU data residency)
```

### Wrangler.toml Configuration:

```toml
[[r2_buckets]]
binding = "EVIDENCE_VAULT"
bucket_name = "realsyncdynamics-evidence-vault"
jurisdiction = "eu"
```

### Evidence Storage Strategy

**Folder Structure:**
```
s3://realsyncdynamics-evidence-vault/
  ├── tenant/{tenant_id}/
  │   ├── audit/{year}/{month}/
  │   ├── policy-eval/{year}/{month}/
  │   └── compliance-reports/{year}/
  └── system-archive/
      ├── backups/
      └── exports/
```

**Metadata (Object Tags):**
```
tenant_id=uuid
retention_years=7
compliance_class=DSGVO_CRITICAL
encrypted=true
hash_chain_verified=true
```

### R2 Lifecycle Policies

```
Retention: 7 years (DSGVO compliance minimum)
Delete: After 7 years automatic purge
Access: Read-only for compliance audits
Versioning: Enabled (immutable history)
```

---

## 5. Worker Migration B1 — Planning Phase

### Current State:
- Pages deployment: Production app
- Edge Functions: Governance, audit, billing
- KV: Policy cache (planned)
- R2: Evidence vault (planned)

### Phase B1 Goals:
1. Migrate governance-core edge functions → Workers
2. Add request/response middleware in Workers
3. Implement request signing (HMAC)
4. Add rate limiting per tenant

### Architecture:

```
Cloudflare Pages (dist/)
    ↓
Cloudflare Workers (middleware)
    ├── Auth check
    ├── Rate limiting
    ├── Request signing
    └── Log to KV
    ↓
Edge Functions (governance-*)
    ├── Policy evaluation
    ├── Audit logging
    └── Cache management (KV)
```

### Timeline:
- Week 1: Define Worker entry point + routing
- Week 2: Implement middleware layer
- Week 3: Migrate governance-core functions
- Week 4: Testing + rollout

---

## 6. Implementation Checklist

### Cache Policies (`_headers`)
- [x] HTML: max-age=0, s-maxage=3600
- [x] Assets: max-age=31536000
- [x] APIs: max-age=0, no-cache
- [x] Governance/Audit: specific TTLs

### KV Namespace
- [ ] Create `governance_policy_cache` namespace
- [ ] Add to wrangler.toml
- [ ] Implement cache reads in governance functions
- [ ] Test TTL expiration
- [ ] Monitor cache hit ratio

### Cache Invalidation
- [ ] Deploy `/api/cache/invalidate` edge function
- [ ] Hook policy service to invalidation endpoint
- [ ] Test cache purge on policy update
- [ ] Add monitoring/alerting

### R2 Vault
- [ ] Create `realsyncdynamics-evidence-vault` bucket
- [ ] Configure lifecycle policies (7-year retention)
- [ ] Set up folder structure
- [ ] Test object upload/retrieval
- [ ] Implement encryption

### Worker Migration B1
- [ ] Design routing architecture
- [ ] Define middleware stack
- [ ] Plan function migration order
- [ ] Schedule rollout timeline

---

## 7. Testing & Verification

### Cache Hit Ratio
```bash
# Monitor in Cloudflare Dashboard:
# Analytics → Caching → Cache Performance
# Target: 70%+ cache hit ratio for assets
```

### KV Operations
```bash
# Test KV in Worker:
wrangler dev --local
# POST http://localhost:8787/api/test-kv
```

### Cache Invalidation
```bash
# Trigger invalidation:
curl -X POST https://realsyncdynamics-ai.pages.dev/api/cache/invalidate \
  -H "Content-Type: application/json" \
  -d '{
    "event": "policy.updated",
    "tenant_id": "test-123",
    "policy_id": "policy-456"
  }'
```

---

## Next Steps

1. **Today:** Commit `_headers` cache policies
2. **Tomorrow:** Create KV namespace + implement cache reads
3. **This Week:** Deploy cache invalidation webhook
4. **Next Week:** R2 setup + Worker B1 planning

**Status Update:** Once complete, update `CLEANUP_STATUS.md` with Phase 3 completion date.
